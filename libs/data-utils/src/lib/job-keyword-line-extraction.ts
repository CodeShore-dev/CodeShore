// `p-limit` ships a CJS `export =` declaration, so it must be imported via
// `import ... = require(...)` to remain valid regardless of whether the
// consuming tsconfig enables `esModuleInterop` (same convention as
// `libs/crawler-core/src/browser/stealth-launch.ts`'s `StealthPlugin` import).
import pLimit = require('p-limit');

import { LineKeywordAiReviewer, LlmClient } from '@codeshore/ai-client';
import { SupabaseTable } from '@codeshore/data-types';
import { parseKeywordsOut, splitDescriptionIntoLines } from '@codeshore/shared-utils';

import { JobService } from './api/job.service';
import { JobDescriptionBinService } from './api/job_description_bin.service';
import { JobDescriptionLineService } from './api/job_description_line.service';
import { JobDescriptionLineKeywordService } from './api/job_description_line_keyword.service';
import { JobKeywordService } from './api/job_keyword.service';
import { MvTechService } from './api/mv_tech';

/** Default number of AI review calls allowed in flight at once (design.md's `AI_REVIEW_CONCURRENCY`). */
export const AI_REVIEW_CONCURRENCY = 5;

export interface GenerateJobKeywordsOptions {
  llmClient: LlmClient;
  concurrency?: number;
  tech?: string;
  keyword?: string;
}

/**
 * Per-job result of steps 1-4 (fetch, noise-strip, per-line rule extraction,
 * AI review) that design.md's steps 5 and 7 (aggregate+dedupe, upsert
 * `job_keyword`) consume below.
 */
interface JobLineKeywordResult {
  jobId: string;
  description_ch_en_ratio: number;
  /** One entry per non-blank line (in line order); each entry is that line's final keyword set. */
  lineFinalKeywords: string[][];
}

/**
 * Batch orchestration: expands every job's `description` into per-line
 * records, runs the existing rule-based extractor per line, submits each
 * line's text + candidate keywords to AI review (bounded by a single shared
 * concurrency limiter across the whole batch), and writes the two new line
 * tables. Mirrors `resetJobKeywords`'s existing pattern of directly
 * constructing its data services rather than receiving them by injection
 * (requirements 1.1-1.4, 2.1-2.2, 3.1-3.4, 4.1-4.3).
 */
export async function generateJobKeywordsFromLines(
  options: GenerateJobKeywordsOptions,
): Promise<void> {
  const { llmClient, concurrency = AI_REVIEW_CONCURRENCY, tech, keyword } = options;

  const reviewer = new LineKeywordAiReviewer(llmClient);
  // Single shared limiter for every line across every job in this batch, per
  // research.md §6.3 -- not one limiter per job.
  const limit = pLimit(concurrency);

  const { result: jobDescriptionBins } = await new JobDescriptionBinService().fetchAll();
  const { result: techs } = await new MvTechService().fetchAll({
    where: { category: { 'not.is': null } },
  });
  const { result: jobs } = await new JobService().fetchAll();

  const allGroupKeywords = techs
    .flatMap(m => m.keywords)
    .concat([tech, keyword].filter(Boolean) as string[]);

  const lineRows: SupabaseTable.JobDescriptionLine[] = [];
  const lineKeywordRows: SupabaseTable.JobDescriptionLineKeyword[] = [];
  const jobResults: JobLineKeywordResult[] = [];
  const reviewTasks: Promise<void>[] = [];

  for (const job of jobs) {
    // Same noise-strip `reduce`/`replace` logic as `resetJobKeywords` (task
    // 3.1 will migrate that function to call this one; this task does not
    // modify `resetJobKeywords` itself).
    const strippedDescription = jobDescriptionBins.reduce(
      (prev, curr) => prev.replace(curr.content, ''),
      job.description,
    );

    // Only `description_ch_en_ratio` is used from this call -- `keywords`
    // (the whole-description extraction) is superseded by the per-line
    // extraction below (research.md §6.3's "description_ch_en_ratio 計算方式" decision).
    const { description_ch_en_ratio } = parseKeywordsOut(
      strippedDescription,
      allGroupKeywords,
    );

    const lines = splitDescriptionIntoLines(strippedDescription);

    const jobResult: JobLineKeywordResult = {
      jobId: job.id,
      description_ch_en_ratio,
      lineFinalKeywords: new Array(lines.length),
    };
    jobResults.push(jobResult);

    lines.forEach((line, lineIndex) => {
      const lineId = crypto.randomUUID();
      const { keywords: candidateKeywords } = parseKeywordsOut(
        line.content,
        allGroupKeywords,
      );

      lineRows.push({
        id: lineId,
        job_id: job.id,
        line_no: line.lineNo,
        content: line.content,
        created_at: new Date().toISOString(),
      });

      // `LineKeywordAiReviewer.review()` never throws (see
      // `line-keyword-reviewer.ts`) -- its `{ ok: false, error }` result is a
      // normal resolved value, so a single line's AI failure can never cause
      // this task (or `Promise.all` below) to reject and abort sibling
      // lines/jobs (requirement 4.3).
      reviewTasks.push(
        limit(async () => {
          const review = await reviewer.review({
            lineText: line.content,
            candidateKeywords,
          });

          let finalKeywords: string[];
          let ai_status: SupabaseTable.JobDescriptionLineKeyword['ai_status'];
          let ai_is_correct: boolean | null;

          if (review.ok) {
            finalKeywords = review.isCorrect ? candidateKeywords : review.keywords;
            ai_status = 'ok';
            ai_is_correct = review.isCorrect;
          } else {
            // Degrade: fall back to the rule-based candidate set (requirement 4.1).
            finalKeywords = candidateKeywords;
            ai_status = 'failed';
            ai_is_correct = null;
          }

          jobResult.lineFinalKeywords[lineIndex] = finalKeywords;

          lineKeywordRows.push({
            id: crypto.randomUUID(),
            line_id: lineId,
            rule_keywords: candidateKeywords,
            ai_status,
            ai_is_correct,
            final_keywords: finalKeywords,
            reviewed_at: new Date().toISOString(),
          });
        }),
      );
    });
  }

  await Promise.all(reviewTasks);

  await new JobDescriptionLineService().reset(lineRows);
  await new JobDescriptionLineKeywordService().reset(lineKeywordRows);

  // design.md step 5 (5.1, 5.3): aggregate each job's per-line final keyword
  // sets by flattening + `Set`-dedupe. A job with zero lines has an empty
  // `lineFinalKeywords` array, so `flat()` + `new Set(...)` naturally yields
  // `[]` -- no special-casing needed for the "no valid lines" case.
  const jobKeywords: SupabaseTable.Job_.Keyword[] = jobResults.map(jobResult => ({
    id: jobResult.jobId,
    keywords: Array.from(new Set(jobResult.lineFinalKeywords.flat())),
    description_ch_en_ratio: jobResult.description_ch_en_ratio,
  }));

  // design.md step 7 (5.2): same shape/interface as the existing
  // `resetJobKeywords()`'s `JobKeywordService().upsert(jobKeywords)` call.
  await new JobKeywordService().upsert(jobKeywords);
}
