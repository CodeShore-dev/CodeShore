import { Annotation, interrupt } from '@langchain/langgraph';
import { Injectable } from '@nestjs/common';

import type { JobKeywordService, TechKeywordService, TechService } from '@codeshore/data-utils';

import type {
  AiRecommendation,
  CommitResult,
  CurationState,
  HumanDecision,
  TechOption,
} from './graph.types';
import type { CurationLlmClassifier } from './llm-classifier';

/**
 * design.md's `KeywordCurationGraph`（LangGraph）section, `CurationAnnotation`
 * state shape (~design.md lines 337-351). Field types and names must match
 * `graph.types.ts`'s `CurationState` verbatim -- `type CurationState = typeof
 * CurationAnnotation.State` per design.md, so this is the LangGraph-facing
 * mirror of that hand-written interface (kept as two separate declarations
 * here since `graph.types.ts` is a plain-TS contracts file with no
 * `@langchain/langgraph` dependency, per task 1.1's boundary).
 */
export const CurationAnnotation = Annotation.Root({
  keyword: Annotation<string>,
  affectedJobCount: Annotation<number>,
  allTechs: Annotation<ReadonlyArray<TechOption>>,
  aiRecommendation: Annotation<AiRecommendation | null>,
  humanDecision: Annotation<HumanDecision | null>,
  commitResult: Annotation<CommitResult | null>,
});

/**
 * Node 1 (`fetchContext`), design.md's `KeywordCurationGraph` section:
 * "載入所有 tech 條目 + 此 keyword 的受影響職缺數 / 輸出：allTechs,
 * affectedJobCount" (requirements 2.1, 2.2).
 *
 * Constructor-injected like `CurationLlmClassifier` (task 2.1) so task 3.6
 * can register this as a normal NestJS provider and inject it into whatever
 * assembles the `StateGraph` -- `this.node` is a bound arrow-function class
 * property (not a prototype method) specifically so it can be passed
 * directly as `.addNode('fetchContext', fetchContextNode.node)` without
 * losing its `this` binding, mirroring design.md's
 * `.addNode('fetchContext', fetchContextNode)` call shape.
 *
 * Only `TechService` and `JobKeywordService` are injected. The task text
 * also names `KeywordService` ("呼叫 KeywordService 取出 keyword 出現次數"),
 * but `CurationState` (graph.types.ts) has no field for a keyword's raw
 * occurrence count -- design.md's Node 1 pseudocode explicitly documents
 * this node's output as only `allTechs, affectedJobCount`, and the
 * occurrence count (`QueuedKeyword.count`) is already known before a
 * session even starts, surfaced by `getQueue()` (task 4.1) from
 * `KeywordService` there. See this task's status report CONCERNS for the
 * full reasoning.
 */
@Injectable()
export class FetchContextNode {
  constructor(
    private readonly techService: Pick<TechService, 'fetchAll'>,
    private readonly jobKeywordService: Pick<JobKeywordService, 'fetchAll'>,
  ) {}

  node = async (state: CurationState): Promise<Partial<CurationState>> => {
    const [{ result: techRows }, affectedJobCount] = await Promise.all([
      this.techService.fetchAll(),
      this.countAffectedJobs(state.keyword),
    ]);

    const allTechs: TechOption[] = techRows.map(tech => ({
      id: tech.id,
      label: tech.label,
      category: tech.category,
    }));

    return { allTechs, affectedJobCount };
  };

  /**
   * Same `cs` (Postgres array-contains) operator pattern as
   * `KeywordMappingGenerator.countAffectedJobs`
   * (apps/backend/src/features/ai-suggestion/generators/keyword-mapping.generator.ts) --
   * duplicated locally rather than imported since that method is private to
   * its class and there is no shared `data-utils` helper for it (checked:
   * `libs/data-utils` exposes no such export).
   */
  private async countAffectedJobs(keyword: string): Promise<number> {
    const { count } = await this.jobKeywordService.fetchAll({
      where: { keywords: { cs: toPgArrayContainsLiteral(keyword) } },
    });
    return count;
  }
}

function toPgArrayContainsLiteral(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `{"${escaped}"}`;
}

/**
 * Node 2 (`classify`), design.md's `KeywordCurationGraph` section (~lines
 * 360-373), requirements 2.1, 2.3, 3.1-3.5: calls
 * `CurationLlmClassifier.classify()` to get an `AiRecommendation` (which may
 * be the `ai_failed` variant -- `classify()` never throws, per task 2.1's
 * contract, so this node has no try/catch of its own), then calls
 * `interrupt(recommendation)` to pause the graph and surface the
 * recommendation as the interrupt payload. When the graph is later resumed
 * via `app.invoke(new Command({ resume: humanDecision }), config)` with the
 * same `thread_id`, `interrupt()` "returns" that `humanDecision` value and
 * node execution continues, so the node's return value captures both the AI
 * recommendation (set before the pause) and the human decision (only known
 * after resume) in a single state update.
 *
 * Same constructor-injected class-based DI shape as `FetchContextNode`
 * (task 3.1) -- `this.node` is a bound arrow-function class property so it
 * can be passed directly as `.addNode('classify', classifyNode.node)`
 * without losing its `this` binding.
 */
@Injectable()
export class ClassifyNode {
  constructor(
    private readonly curationLlmClassifier: Pick<CurationLlmClassifier, 'classify'>,
  ) {}

  node = async (state: CurationState): Promise<Partial<CurationState>> => {
    const recommendation = await this.curationLlmClassifier.classify(
      state.keyword,
      state.affectedJobCount,
      state.allTechs,
    );

    // Pauses graph execution here; on resume via
    // `app.invoke(new Command({ resume: humanDecision }), config)` this call
    // returns `humanDecision` and execution continues past this line.
    const decision = interrupt<AiRecommendation, HumanDecision>(recommendation);

    return { aiRecommendation: recommendation, humanDecision: decision };
  };
}

/**
 * Node 4a (`commitMapping`), design.md's `KeywordCurationGraph` section
 * (~lines 378-379: "目的：techKeywordService.upsert([{ tech: confirmedTechId,
 * keyword }])"), requirements 5.2, 5.3: writes the confirmed path-A
 * keyword->tech mapping and reports the outcome as a `CommitResult`.
 *
 * Same constructor-injected class-based DI shape as `FetchContextNode`/
 * `ClassifyNode` -- `this.node` is a bound arrow-function class property so
 * it can be passed directly as `.addNode('commitMapping', commitMappingNode.node)`
 * without losing its `this` binding.
 *
 * This node is only reachable via task 3.6's future conditional routing when
 * `humanDecision.path === 'A'` (design.md ~line 405:
 * `.addConditionalEdges('classify', routeByDecision, { A: 'commitMapping', ... })`),
 * so arriving here with `state.humanDecision` missing or not the path-A
 * variant is an impossible state caused only by a routing bug -- not a
 * recoverable business scenario the frontend needs a message for. It is
 * therefore asserted (thrown) rather than encoded as a `CommitResult.ok:
 * false` value, which design.md's error-handling table reserves for actual
 * upsert failures (requirement 9.1).
 */
@Injectable()
export class CommitMappingNode {
  constructor(private readonly techKeywordService: Pick<TechKeywordService, 'upsert'>) {}

  node = async (state: CurationState): Promise<Partial<CurationState>> => {
    const decision = state.humanDecision;
    if (decision === null || decision.path !== 'A') {
      throw new Error(
        `CommitMappingNode requires humanDecision.path === 'A', got: ${JSON.stringify(decision)}`,
      );
    }

    const { confirmedTechId } = decision;
    const { error } = await this.techKeywordService.upsert([
      { tech: confirmedTechId, keyword: state.keyword },
    ]);

    if (error) {
      // design.md's error-handling table (requirement 9.1) specifies
      // `partialChanges: []` literally for a path-A commit failure -- the
      // single upsert either fully succeeds or fully fails, so there is no
      // partial state to report.
      return {
        commitResult: {
          ok: false,
          error: error.message ?? 'Unknown error committing tech_keyword mapping',
          partialChanges: [],
        },
      };
    }

    return {
      commitResult: {
        ok: true,
        changes: [
          {
            type: 'tech_keyword',
            details: { keyword: state.keyword, tech: confirmedTechId },
            status: 'committed',
          },
        ],
      },
    };
  };
}
