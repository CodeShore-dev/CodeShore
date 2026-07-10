import { Injectable } from '@nestjs/common';
import { Command, INTERRUPT, isInterrupted } from '@langchain/langgraph';

import type {
  JobKeywordService,
  KeywordBinService,
  KeywordService,
  TechKeywordService,
} from '@codeshore/data-utils';

import { toPgArrayContainsLiteral } from './graph';
import type { KeywordCurationGraph } from './graph';
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
    private readonly graph: Pick<KeywordCurationGraph, 'app'>,
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

  /**
   * Requirement 2.1 / design.md's "Session 操作" pseudocode (~lines
   * 417-425): generates a fresh `thread_id`, invokes the (singleton, shared
   * `MemorySaver`-backed) `KeywordCurationGraph.app` with the initial
   * `CurationState` for `keyword`, and runs it to its first `interrupt()` (in
   * `ClassifyNode`, task 3.2) -- including the `ai_failed` degraded variant
   * (requirement 3.5, 9.2), which is still an `interrupt()` payload, not a
   * thrown error. `isInterrupted()`/`INTERRUPT` extraction mirrors the exact
   * pattern already proven in `graph.spec.ts`'s own tests (tasks 3.2/3.6).
   */
  async startSession(keyword: string): Promise<StartSessionResult> {
    try {
      const threadId = crypto.randomUUID();
      const config = { configurable: { thread_id: threadId } };

      const result = await this.graph.app.invoke(
        {
          keyword,
          allTechs: [],
          affectedJobCount: 0,
          aiRecommendation: null,
          humanDecision: null,
          commitResult: null,
        },
        config,
      );

      if (!isInterrupted<AiRecommendation>(result)) {
        throw new Error(
          `KeywordCurationGraph did not pause at interrupt() for keyword "${keyword}" as expected`,
        );
      }

      const interrupt = result[INTERRUPT][0].value;
      if (interrupt === undefined) {
        throw new Error(
          `KeywordCurationGraph's interrupt() payload was undefined for keyword "${keyword}"`,
        );
      }
      return { ok: true, threadId, interrupt };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  }

  /**
   * Requirement 4.1, 5.2, 6.7, 7.2 / design.md's "Session 操作" pseudocode
   * (~lines 427-431): resumes the paused graph run for `threadId` with the
   * admin's `decision` via `Command({ resume: decision })`, running it to
   * completion (one of the three commit nodes, tasks 3.3-3.5), and returns
   * the resulting `CommitResult`.
   *
   * `threadId` existence is checked first via `graph.app.getState(config)`:
   * an unrecognized `thread_id` (never started, or a `MemorySaver` that has
   * since been replaced) resolves with no saved checkpoint tuple, which
   * `KeywordCurationGraph`'s underlying `@langchain/langgraph` `Pregel.getState`
   * surfaces as an empty `{ values: {}, next: [], config, tasks: [] }`
   * snapshot -- `values` is empty *only* in that unknown-thread case, since
   * any real (paused or completed) session's checkpoint always has at least
   * `keyword` populated in `values` (it is part of the initial `invoke()`
   * input merged into the very first checkpoint). Checking `next` alone
   * would not work here: a *completed* run also has an empty `next` (no
   * pending tasks), so it would be indistinguishable from an unknown thread.
   */
  async resumeSession(
    threadId: string,
    decision: HumanDecision,
  ): Promise<ResumeSessionResult> {
    const config = { configurable: { thread_id: threadId } };

    try {
      const state = await this.graph.app.getState(config);
      if (Object.keys(state.values).length === 0) {
        return {
          ok: false,
          error: 'thread_not_found',
          message: `No curation session found for threadId "${threadId}"`,
        };
      }

      const result = await this.graph.app.invoke(new Command({ resume: decision }), config);

      const commitResult: CommitResult | null = result.commitResult;
      if (commitResult === null) {
        return {
          ok: false,
          error: 'graph_error',
          message: `KeywordCurationGraph completed for threadId "${threadId}" without producing a commitResult`,
        };
      }

      return { ok: true, result: commitResult };
    } catch (error) {
      return { ok: false, error: 'graph_error', message: toErrorMessage(error) };
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
