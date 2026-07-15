import pLimit = require('p-limit');

import { LineKeywordAiReviewer, LlmClient } from '@codeshore/ai-client';
import { KeywordGroup, SupabaseTable } from '@codeshore/data-types';
import { parseKeywordsOut, splitDescriptionIntoLines } from '@codeshore/shared-utils';

import { JobService } from './api/job.service';
import { JobDescriptionBinService } from './api/job_description_bin.service';
import { JobDescriptionLineService } from './api/job_description_line.service';
import { JobDescriptionLineKeywordService } from './api/job_description_line_keyword.service';
import { JobKeywordService } from './api/job_keyword.service';
import { MvTechService } from './api/mv_tech';

/** Default number of AI review calls allowed in flight at once. */
export const AI_REVIEW_CONCURRENCY = 5;

export interface GenerateJobKeywordsOptions {
  llmClient: LlmClient;
  concurrency?: number;
  tech?: string;
  keyword?: string;
}

interface JobLineKeywordResult {
  jobId: string;
  description_ch_en_ratio: number;
  /** One entry per stored line; each entry is that line's AI-identified keyword groups. */
  lineGroups: KeywordGroup[][];
}

/**
 * Batch orchestration: splits every job's `description` into per-line
 * records, submits each line to AI review (no pre-extracted candidate hints),
 * and writes `job_description_line` and `job_description_line_keyword`.
 * All non-blank lines are stored and sent to AI regardless of content.
 */
export async function generateJobKeywordsFromLines(
  options: GenerateJobKeywordsOptions,
): Promise<void> {
  const { llmClient, concurrency = AI_REVIEW_CONCURRENCY, tech, keyword } = options;

  const reviewer = new LineKeywordAiReviewer(llmClient);
  const limit = pLimit(concurrency);

  const { result: jobDescriptionBins } = await new JobDescriptionBinService().fetchAll();
  const { result: techs } = await new MvTechService().fetchAll({
    where: { category: { 'not.is': null } },
  });
  const { result: jobs } = await new JobService().fetchAll();

  // `allGroupKeywords` used only for `description_ch_en_ratio` on the whole description.
  const allGroupKeywords = techs
    .flatMap(m => m.keywords)
    .concat([tech, keyword].filter(Boolean) as string[]);

  // Unique category names — small vocabulary list passed to AI instead of the full keyword map.
  const categories = Array.from(new Set(techs.map(t => t.category).filter(Boolean))) as string[];

  const lineRows: SupabaseTable.JobDescriptionLine[] = [];
  const lineKeywordRows: SupabaseTable.JobDescriptionLineKeyword[] = [];
  const jobResults: JobLineKeywordResult[] = [];
  const reviewTasks: Promise<void>[] = [];

  for (const job of jobs) {
    const strippedDescription = jobDescriptionBins.reduce(
      (prev, curr) => prev.replace(curr.content, ''),
      job.description,
    );

    const { description_ch_en_ratio } = parseKeywordsOut(strippedDescription, allGroupKeywords);

    const lines = splitDescriptionIntoLines(strippedDescription).filter(
      line => line.content.trim().length > 0,
    );

    const jobResult: JobLineKeywordResult = {
      jobId: job.id,
      description_ch_en_ratio,
      lineGroups: [],
    };
    jobResults.push(jobResult);

    for (const line of lines) {
      const lineId = crypto.randomUUID();

      lineRows.push({
        id: lineId,
        job_id: job.id,
        line_no: line.lineNo,
        content: line.content,
        created_at: new Date().toISOString(),
      });

      reviewTasks.push(
        limit(async () => {
          const review = await reviewer.review({
            lineText: line.content,
            categories,
          });

          let finalGroups: KeywordGroup[];
          let ai_status: SupabaseTable.JobDescriptionLineKeyword['ai_status'];

          if (review.ok) {
            finalGroups = review.groups;
            ai_status = 'ok';
          } else {
            finalGroups = [];
            ai_status = 'failed';
          }

          jobResult.lineGroups.push(finalGroups);

          lineKeywordRows.push({
            id: crypto.randomUUID(),
            line_id: lineId,
            rule_keywords: [],
            ai_status,
            ai_is_correct: null,
            final_keyword_groups: finalGroups,
            reviewed_at: new Date().toISOString(),
          });
        }),
      );
    }
  }

  await Promise.all(reviewTasks);

  await new JobDescriptionLineService().reset(lineRows);
  await new JobDescriptionLineKeywordService().reset(lineKeywordRows);

  const jobKeywords: SupabaseTable.Job_.Keyword[] = jobResults.map(jobResult => {
    const allGroups: KeywordGroup[] = jobResult.lineGroups.flat();
    const seen = new Set<string>();
    const keyword_groups: KeywordGroup[] = allGroups.filter(g => {
      const key = `${g.category}:${[...g.keywords].sort().join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      id: jobResult.jobId,
      keywords: Array.from(new Set(keyword_groups.flatMap(g => g.keywords))),
      description_ch_en_ratio: jobResult.description_ch_en_ratio,
      keyword_groups,
    };
  });

  await new JobKeywordService().upsert(jobKeywords);
}
