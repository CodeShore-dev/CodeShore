// `p-limit` ships a CJS `export =` declaration, so it must be imported via
// `import ... = require(...)` to remain valid regardless of whether the
// consuming tsconfig enables `esModuleInterop` (same convention as
// `job-keyword-line-extraction.ts`/`libs/crawler-core/src/browser/stealth-launch.ts`).
import pLimit = require('p-limit');

import { LineKeywordAiReviewer, LlmClient } from '@codeshore/ai-client';
import { SupabaseTable } from '@codeshore/data-types';
import { parseKeywordsOut, splitDescriptionIntoLines } from '@codeshore/shared-utils';

import { JobService } from './api/job.service';
import { JobDescriptionBinService } from './api/job_description_bin.service';
import { JobDescriptionLineService } from './api/job_description_line.service';
import { JobDescriptionLineKeywordService } from './api/job_description_line_keyword.service';
import { MvTechService } from './api/mv_tech';
import { AI_REVIEW_CONCURRENCY } from './job-keyword-line-extraction';

export interface GenerateJobDescriptionLinesOptions {
  /** Optional filter on `job` (same shape as `ListQuery.where`); omitted means every job. */
  where?: Record<string, unknown>;
}

/**
 * Stage 1 only: `job.description` -> `job_description_line`. Independent
 * entry point alongside `generateJobKeywordsFromLines` (which still does
 * both stages in one call for the existing `/keyword/group/reset` route and
 * the crawler CLI -- neither of those call sites is touched by this
 * function). Scoped to `options.where`-matched jobs: only those jobs'
 * existing line rows are replaced, via `replaceWhereIn` rather than
 * `reset()`, so an out-of-scope job's lines are left untouched.
 */
export async function generateJobDescriptionLines(
  options: GenerateJobDescriptionLinesOptions = {},
): Promise<void> {
  const { where } = options;

  const { result: jobDescriptionBins } = await new JobDescriptionBinService().fetchAll();
  const { result: jobs } = await new JobService().fetchAll({
    where,
    select: 'id,description',
  });

  const lineRows: SupabaseTable.JobDescriptionLine[] = [];

  for (const job of jobs) {
    // Same noise-strip `reduce`/`replace` logic as
    // `generateJobKeywordsFromLines`/`resetJobKeywords`.
    const strippedDescription = jobDescriptionBins.reduce(
      (prev, curr) => prev.replace(curr.content, ''),
      job.description,
    );

    for (const line of splitDescriptionIntoLines(strippedDescription)) {
      lineRows.push({
        id: crypto.randomUUID(),
        job_id: job.id,
        line_no: line.lineNo,
        content: line.content,
        created_at: new Date().toISOString(),
      });
    }
  }

  const jobIds = jobs.map(job => job.id);
  await new JobDescriptionLineService().replaceWhereIn('job_id', jobIds, lineRows);
}

export interface GenerateJobDescriptionLineKeywordsOptions {
  llmClient: LlmClient;
  concurrency?: number;
  /** Optional filter on `job` (same shape as `ListQuery.where`); omitted means every job's existing lines. */
  where?: Record<string, unknown>;
}

/**
 * Stage 2 only: existing `job_description_line` rows -> rule extraction ->
 * AI review -> `job_description_line_keyword`. Deliberately does NOT touch
 * `job_keyword` -- that aggregation stays owned by
 * `generateJobKeywordsFromLines`'s combined pipeline (and its callers,
 * `resetJobKeywords`/the crawler CLI, neither of which this function
 * changes). Resolves `options.where` against `job` first, then operates on
 * whichever `job_description_line` rows already exist for those job ids
 * (does not re-derive lines from `job.description` itself -- run stage 1
 * first if the lines aren't there yet).
 */
export async function generateJobDescriptionLineKeywords(
  options: GenerateJobDescriptionLineKeywordsOptions,
): Promise<void> {
  const { llmClient, concurrency = AI_REVIEW_CONCURRENCY, where } = options;

  const reviewer = new LineKeywordAiReviewer(llmClient);
  // Single shared limiter across the whole scoped batch, same as
  // `generateJobKeywordsFromLines` (research.md §6.3).
  const limit = pLimit(concurrency);

  const { result: techs } = await new MvTechService().fetchAll({
    where: { category: { 'not.is': null } },
  });
  const allGroupKeywords = techs.flatMap(m => m.keywords);

  const { result: jobs } = await new JobService().fetchAll({ where, select: 'id' });
  const jobIds = jobs.map(job => job.id);

  const { result: lines } = await new JobDescriptionLineService().findWhereIn(
    'job_id',
    jobIds,
  );

  const lineKeywordRows: SupabaseTable.JobDescriptionLineKeyword[] = [];
  const reviewTasks: Promise<void>[] = [];

  for (const line of lines) {
    const { keywords: candidateKeywords } = parseKeywordsOut(line.content, allGroupKeywords);

    // `LineKeywordAiReviewer.review()` never throws -- a single line's AI
    // failure can never abort sibling lines (requirement 4.3's isolation
    // guarantee, unchanged from `generateJobKeywordsFromLines`).
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
          // Degrade: fall back to the rule-based candidate set.
          finalKeywords = candidateKeywords;
          ai_status = 'failed';
          ai_is_correct = null;
        }

        lineKeywordRows.push({
          id: crypto.randomUUID(),
          line_id: line.id,
          rule_keywords: candidateKeywords,
          ai_status,
          ai_is_correct,
          final_keywords: finalKeywords,
          reviewed_at: new Date().toISOString(),
        });
      }),
    );
  }

  await Promise.all(reviewTasks);

  const lineIds = lines.map(line => line.id);
  await new JobDescriptionLineKeywordService().replaceWhereIn(
    'line_id',
    lineIds,
    lineKeywordRows,
  );
}
