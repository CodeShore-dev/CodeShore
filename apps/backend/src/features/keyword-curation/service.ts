import { Injectable } from '@nestjs/common';

import type {
  JobKeywordService,
  KeywordBinService,
  KeywordService,
  TechKeywordService,
} from '@codeshore/data-utils';

import { toPgArrayContainsLiteral } from './graph';
import type {
  AiRecommendation,
  CommitResult,
  HumanDecision,
  QueuedKeyword,
} from './graph.types';

/**
 * Minimum `keyword.count` for a keyword to be surfaced in the curation
 * queue (requirement 1: "僅顯示出現次數達到最低門檻...的 keyword"). Same
 * value and rationale as
 * `ai-suggestion/generators/keyword-mapping.generator.ts`'s
 * `KEYWORD_COUNT_THRESHOLD` -- design.md's `getQueue()` pseudocode
 * explicitly calls out "過濾邏輯與 KeywordMappingGenerator.selectCandidates()
 * 相同", but that generator lives in `ai-suggestion/`, which is not an
 * allowed import for this feature (design.md's boundary/allowed-dependencies
 * table), so the constant and filtering logic are reimplemented locally
 * here rather than imported.
 */
export const KEYWORD_COUNT_THRESHOLD = 10;

/**
 * design.md's `KeywordCurationServiceContract` — result of starting a
 * curation session: the LangGraph run to its first `interrupt()` (task
 * 3.1-3.6 wire the actual graph; this task only establishes the shape).
 */
export type StartSessionResult =
  | { ok: true; threadId: string; interrupt: AiRecommendation }
  | { ok: false; error: string };

/**
 * design.md's `KeywordCurationServiceContract` — result of resuming a
 * curation session with the admin's decision, running the graph to
 * completion.
 */
export type ResumeSessionResult =
  | { ok: true; result: CommitResult }
  | { ok: false; error: 'thread_not_found' | 'graph_error'; message: string };

/**
 * Requirement 2.1 / design.md's `KeywordCurationService` contract. This task
 * (1.2) only establishes the type-correct method skeleton against
 * `graph.types.ts` (task 1.1); the queue query (task 4.1), LangGraph session
 * start/resume wiring (task 4.2) and the graph itself (tasks 3.1-3.6) are
 * implemented in later tasks.
 */
@Injectable()
export class Service {
  constructor(
    private readonly keywordService: Pick<KeywordService, 'fetchAll'>,
    private readonly techKeywordService: Pick<TechKeywordService, 'fetchAll'>,
    private readonly keywordBinService: Pick<KeywordBinService, 'fetchAll'>,
    private readonly jobKeywordService: Pick<JobKeywordService, 'fetchAll'>,
  ) {}

  /**
   * Requirement 1.1-1.3 / design.md's `getQueue()` pseudocode: keywords
   * at/above `KEYWORD_COUNT_THRESHOLD`, not already mapped in
   * `tech_keyword`, and not already excluded via `keyword_bin`, each
   * annotated with `affectedJobCount` (requirement 1.2's "在每個 keyword
   * 旁顯示其在職缺資料中的出現次數" is `count`; `affectedJobCount` is the
   * separate `job_keyword`-derived figure the AI recommendation and commit
   * flow use), sorted by `count` descending (requirement 1.1). Mirrors
   * `KeywordMappingGenerator.selectCandidates()`'s filter logic exactly, per
   * design.md's explicit note, but reimplemented locally since importing
   * from `ai-suggestion/` crosses this feature's boundary (see
   * `KEYWORD_COUNT_THRESHOLD`'s doc comment above).
   */
  async getQueue(): Promise<{ keywords: QueuedKeyword[] }> {
    const [{ result: keywords }, { result: techKeywords }, { result: keywordBinRows }] =
      await Promise.all([
        this.keywordService.fetchAll({
          orders: [{ column: 'count', ascending: false }],
        }),
        this.techKeywordService.fetchAll(),
        this.keywordBinService.fetchAll(),
      ]);

    const alreadyMapped = new Set(
      techKeywords.map((row: { keyword: string }) => row.keyword),
    );
    const alreadyExcluded = new Set(
      keywordBinRows.map((row: { id: string }) => row.id),
    );

    const candidates = keywords.filter(
      (keyword: { id: string; count: number }) =>
        keyword.count >= KEYWORD_COUNT_THRESHOLD &&
        !alreadyMapped.has(keyword.id) &&
        !alreadyExcluded.has(keyword.id),
    ) as Array<{ id: string; count: number }>;

    const queuedKeywords = await Promise.all(
      candidates.map(async candidate => ({
        id: candidate.id,
        count: candidate.count,
        affectedJobCount: await this.countAffectedJobs(candidate.id),
      })),
    );

    queuedKeywords.sort((a, b) => b.count - a.count);

    return { keywords: queuedKeywords };
  }

  /**
   * Same `cs` (Postgres array-contains) operator pattern as
   * `graph.ts`'s `FetchContextNode.countAffectedJobs` and
   * `ai-suggestion/generators/keyword-mapping.generator.ts`'s
   * `countAffectedJobs` -- shared with `graph.ts` (both within this
   * feature's own boundary) via `toPgArrayContainsLiteral`.
   */
  private async countAffectedJobs(keyword: string): Promise<number> {
    const { count } = await this.jobKeywordService.fetchAll({
      where: { keywords: { cs: toPgArrayContainsLiteral(keyword) } },
    });
    return count;
  }

  async startSession(keyword: string): Promise<StartSessionResult> {
    throw new Error(
      `Service.startSession not implemented (keyword: ${keyword})`,
    );
  }

  async resumeSession(
    threadId: string,
    decision: HumanDecision,
  ): Promise<ResumeSessionResult> {
    throw new Error(
      `Service.resumeSession not implemented (threadId: ${threadId}, decision.path: ${decision.path})`,
    );
  }
}
