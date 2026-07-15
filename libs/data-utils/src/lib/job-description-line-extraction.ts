import pLimit = require('p-limit');

import { LineKeywordAiReviewer, LlmClient } from '@codeshore/ai-client';
import { KeywordGroup, SupabaseTable } from '@codeshore/data-types';
import { splitDescriptionIntoLines } from '@codeshore/shared-utils';

import { JobService } from './api/job.service';
import { JobDescriptionBinService } from './api/job_description_bin.service';
import { JobDescriptionLineService } from './api/job_description_line.service';
import { JobDescriptionLineKeywordService } from './api/job_description_line_keyword.service';
import { MvTechService } from './api/mv_tech';
import { AI_REVIEW_CONCURRENCY } from './job-keyword-line-extraction';
import { ServiceLogger } from '@codeshore/service-logger';

export interface GenerateJobDescriptionLinesOptions {
  /** Optional filter on `job`; omitted means every job. */
  where?: Record<string, unknown>;
}

/**
 * Stage 1 only: `job.description` -> `job_description_line`.
 * Stores all non-blank lines without keyword pre-filtering.
 * Scoped to `options.where`-matched jobs via `replaceWhereIn`.
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
    const strippedDescription = jobDescriptionBins.reduce(
      (prev, curr) => prev.replace(curr.content, ''),
      job.description,
    );

    const lines = splitDescriptionIntoLines(strippedDescription).filter(
      line => line.content.trim().length > 0,
    );

    for (const line of lines) {
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
  /** Optional filter on `job`; omitted means every job's existing lines. */
  where?: Record<string, unknown>;
  logger?: ServiceLogger;
}

/**
 * Stage 2 only: existing `job_description_line` rows -> AI review ->
 * `job_description_line_keyword`. The AI identifies keywords from each line
 * using only the category vocabulary, without pre-extracted candidate hints.
 * Does not touch `job_keyword`.
 */
export async function generateJobDescriptionLineKeywords(
  options: GenerateJobDescriptionLineKeywordsOptions,
): Promise<void> {
  const { llmClient, concurrency = AI_REVIEW_CONCURRENCY, where } = options;

  const reviewer = new LineKeywordAiReviewer(llmClient, options.logger);
  const limit = pLimit(concurrency);

  const { result: techs } = await new MvTechService().fetchAll({
    where: { category: { 'not.is': null } },
  });

  // Unique category names — small vocabulary list for the AI prompt.
  const categories = Array.from(new Set(techs.map(t => t.category).filter(Boolean))) as string[];

  const { result: jobs } = await new JobService().fetchAll({ where, select: 'id' });
  const jobIds = jobs.map(job => job.id);

  const { result: lines } = await new JobDescriptionLineService().findWhereIn('job_id', jobIds);

  const lineKeywordRows: SupabaseTable.JobDescriptionLineKeyword[] = [];
  const reviewTasks: Promise<void>[] = [];

  for (const line of lines) {
    reviewTasks.push(
      limit(async () => {
        const review = await reviewer.review({
          lineText: line.content,
          categories,
        });

        let finalKeywordGroups: KeywordGroup[];
        let ai_status: SupabaseTable.JobDescriptionLineKeyword['ai_status'];

        if (review.ok) {
          finalKeywordGroups = review.groups;
          ai_status = 'ok';
        } else {
          finalKeywordGroups = [];
          ai_status = 'failed';
        }

        lineKeywordRows.push({
          id: crypto.randomUUID(),
          line_id: line.id,
          rule_keywords: [],
          ai_status,
          ai_is_correct: null,
          final_keyword_groups: finalKeywordGroups,
          reviewed_at: new Date().toISOString(),
        });
      }),
    );
  }

  await Promise.all(reviewTasks);

  const lineIds = lines.map(line => line.id);
  await new JobDescriptionLineKeywordService(options.logger).replaceWhereIn('line_id', lineIds, lineKeywordRows);
}
