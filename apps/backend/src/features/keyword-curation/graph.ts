import { Annotation, END, interrupt, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { Injectable } from '@nestjs/common';

import type {
  JobKeywordService,
  KeywordBinService,
  TechKeywordService,
  TechParentService,
  TechService,
} from '@codeshore/data-utils';

import { detectTechParentCycle } from '../ai-suggestion/validation/cycle-check';
import type {
  AiRecommendation,
  CommittedChange,
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

/**
 * Node 4b (`validateAndCommitNewTech`), design.md's `KeywordCurationGraph`
 * section (~lines 381-387) and error-handling table (~lines 631-640),
 * requirements 6.5, 6.7, 6.8, 9.3.
 *
 * Two validations run before any write, in this order, each aborting the
 * entire commit with `partialChanges: []` and NO writes on any of the three
 * services if triggered:
 *
 *   1. Cycle check (requirement 6.5): `detectTechParentCycle(parent, child)`
 *      is called once per `confirmedEdges` entry. If any edge reports
 *      `hasCycle: true`, the commit aborts with
 *      `{ ok: false, error: 'cycle_detected', partialChanges: [] }`.
 *      `detectTechParentCycle` throws on an RPC-level failure (its own
 *      contract, `ai-suggestion/validation/cycle-check.ts`) rather than
 *      returning an `ok:false`-shaped result -- that throw is intentionally
 *      left to propagate out of this node uncaught, mirroring
 *      `CommitMappingNode`'s precedent (task 3.3) of throwing on states this
 *      node cannot itself recover from: a broken cycle-check RPC is an
 *      infrastructure failure the caller must surface, not a normal
 *      business-level `CommitResult.ok: false` outcome.
 *   2. Duplicate id pre-check (requirement 6.8): `techService.fetchAll({
 *      where: { id: { eq: newTech.id } } })` is checked for an existing row
 *      BEFORE calling `techService.upsert()`. This is deliberate: Postgres
 *      UPSERT semantics would otherwise silently overwrite an existing tech
 *      row rather than erroring, but requirement 6.8 needs the admin
 *      explicitly blocked and asked to change the id, so detecting the
 *      conflict via a pre-check is more reliable than depending on
 *      `upsert()` to reject it. On a match, the commit aborts with
 *      `{ ok: false, error: 'duplicate_id', partialChanges: [] }`.
 *
 * Once both validations pass, steps 2-4 (design.md's Node 4b pseudocode
 * numbering) run in sequence -- `tech` upsert, then `tech_keyword` upsert,
 * then one `tech_parent` upsert per `confirmedEdges` entry -- and do NOT
 * abort on individual failure (requirement 9.3 / design.md's "路徑 B 部分失敗"
 * row: "任一失敗即記錄於 partialChanges，剩餘步驟仍繼續"). Each step's outcome is
 * recorded as one `CommittedChange`; execution always continues to the next
 * step regardless of the previous step's outcome. The final result is
 * `ok: true` with all changes only if every step committed; otherwise
 * `ok: false` with an aggregate error message naming the failed step(s) and
 * `partialChanges` containing every step's outcome (committed and failed
 * alike).
 *
 * Same constructor-injected class-based DI shape as the other nodes in this
 * file -- `this.node` is a bound arrow-function class property so it can be
 * passed directly as
 * `.addNode('validateAndCommitNewTech', validateAndCommitNewTechNode.node)`
 * without losing its `this` binding.
 *
 * Like `CommitMappingNode`, this node is only reachable via task 3.6's
 * future conditional routing when `humanDecision.path === 'B'`, so arriving
 * here with a missing or non-path-B `humanDecision` is an impossible state
 * caused only by a routing bug and is thrown rather than encoded as a
 * `CommitResult.ok: false` value.
 */
@Injectable()
export class ValidateAndCommitNewTechNode {
  constructor(
    private readonly techService: Pick<TechService, 'fetchAll' | 'upsert'>,
    private readonly techKeywordService: Pick<TechKeywordService, 'upsert'>,
    private readonly techParentService: Pick<TechParentService, 'upsert'>,
  ) {}

  node = async (state: CurationState): Promise<Partial<CurationState>> => {
    const decision = state.humanDecision;
    if (decision === null || decision.path !== 'B') {
      throw new Error(
        `ValidateAndCommitNewTechNode requires humanDecision.path === 'B', got: ${JSON.stringify(decision)}`,
      );
    }

    const { newTech, confirmedEdges } = decision;

    // Validation 1: cycle check, per edge, before any writes (requirement 6.5).
    for (const edge of confirmedEdges) {
      const { hasCycle } = await detectTechParentCycle(edge.parentId, edge.childId);
      if (hasCycle) {
        return { commitResult: { ok: false, error: 'cycle_detected', partialChanges: [] } };
      }
    }

    // Validation 2: duplicate id pre-check, before any writes (requirement 6.8).
    const { result: existingTechs } = await this.techService.fetchAll({
      where: { id: { eq: newTech.id } },
    });
    if (existingTechs.length > 0) {
      return { commitResult: { ok: false, error: 'duplicate_id', partialChanges: [] } };
    }

    const changes: CommittedChange[] = [];

    // Step 2: tech
    const techDetails = { id: newTech.id, label: newTech.label, category: newTech.category };
    const { error: techError } = await this.techService.upsert([
      {
        id: newTech.id,
        label: newTech.label,
        category: newTech.category,
        icon_slugs: newTech.iconSlugs,
        tags: newTech.tags,
      },
    ]);
    changes.push(
      techError
        ? {
            type: 'tech',
            details: techDetails,
            status: 'failed',
            error: techError.message ?? 'Unknown error committing tech',
          }
        : { type: 'tech', details: techDetails, status: 'committed' },
    );

    // Step 3: tech_keyword
    const keywordDetails = { tech: newTech.id, keyword: state.keyword };
    const { error: keywordError } = await this.techKeywordService.upsert([
      { tech: newTech.id, keyword: state.keyword },
    ]);
    changes.push(
      keywordError
        ? {
            type: 'tech_keyword',
            details: keywordDetails,
            status: 'failed',
            error: keywordError.message ?? 'Unknown error committing tech_keyword mapping',
          }
        : { type: 'tech_keyword', details: keywordDetails, status: 'committed' },
    );

    // Step 4: tech_parent, once per confirmed edge
    for (const edge of confirmedEdges) {
      const edgeDetails = { parent: edge.parentId, child: edge.childId };
      const { error: edgeError } = await this.techParentService.upsert([
        { parent: edge.parentId, child: edge.childId },
      ]);
      changes.push(
        edgeError
          ? {
              type: 'tech_parent',
              details: edgeDetails,
              status: 'failed',
              error: edgeError.message ?? 'Unknown error committing tech_parent edge',
            }
          : { type: 'tech_parent', details: edgeDetails, status: 'committed' },
      );
    }

    const failedSteps = changes.filter(change => change.status === 'failed');
    if (failedSteps.length > 0) {
      return {
        commitResult: {
          ok: false,
          error: `Failed to commit: ${failedSteps.map(change => change.type).join(', ')}`,
          partialChanges: changes,
        },
      };
    }

    return { commitResult: { ok: true, changes } };
  };
}

/**
 * Node 4c (`commitKeywordBin`), design.md's `KeywordCurationGraph` section
 * (~lines 389-390: "目的：keywordBinService.upsert([{ id: keyword }])"),
 * requirement 7.2: writes the confirmed path-C keyword to `keyword_bin`
 * (marking it as noise, excluded from future workflow candidates -- see
 * requirement 7.1) and reports the outcome as a `CommitResult`.
 *
 * Same constructor-injected class-based DI shape as `CommitMappingNode`
 * (task 3.3) -- `this.node` is a bound arrow-function class property so it
 * can be passed directly as
 * `.addNode('commitKeywordBin', commitKeywordBinNode.node)` without losing
 * its `this` binding.
 *
 * Like `CommitMappingNode`/`ValidateAndCommitNewTechNode`, this node is only
 * reachable via task 3.6's future conditional routing when
 * `humanDecision.path === 'C'`, so arriving here with `state.humanDecision`
 * missing or not the path-C variant is an impossible state caused only by a
 * routing bug, and is thrown rather than encoded as a `CommitResult.ok:
 * false` value -- same precedent as `CommitMappingNode` (task 3.3).
 *
 * design.md has no explicit error-table row for a path-C commit failure;
 * `CommitMappingNode`'s single-step-commit failure shape
 * (`partialChanges: []`) is the right template since this is likewise a
 * single upsert that either fully succeeds or fully fails.
 */
@Injectable()
export class CommitKeywordBinNode {
  constructor(private readonly keywordBinService: Pick<KeywordBinService, 'upsert'>) {}

  node = async (state: CurationState): Promise<Partial<CurationState>> => {
    const decision = state.humanDecision;
    if (decision === null || decision.path !== 'C') {
      throw new Error(
        `CommitKeywordBinNode requires humanDecision.path === 'C', got: ${JSON.stringify(decision)}`,
      );
    }

    const { error } = await this.keywordBinService.upsert([{ id: state.keyword }]);

    if (error) {
      // Mirrors `CommitMappingNode`'s failure-path shape (task 3.3): a
      // single-step commit's failure has no partial state to report.
      return {
        commitResult: {
          ok: false,
          error: error.message ?? 'Unknown error committing keyword_bin entry',
          partialChanges: [],
        },
      };
    }

    return {
      commitResult: {
        ok: true,
        changes: [
          {
            type: 'keyword_bin',
            details: { id: state.keyword },
            status: 'committed',
          },
        ],
      },
    };
  };
}

/** Target node names for `routeByDecision`'s conditional-edge routing. */
export type CommitNodeName = 'commitMapping' | 'validateAndCommitNewTech' | 'commitKeywordBin';

/**
 * Node 3 (`routeDecision`, the conditional edge), design.md's
 * `KeywordCurationGraph` section (~line 375: "目的：根據 humanDecision.path
 * 分發至對應 commit 節點" and ~lines 404-408's `addConditionalEdges('classify',
 * routeByDecision, { A: 'commitMapping', B: 'validateAndCommitNewTech', C:
 * 'commitKeywordBin' })`), requirements 2.1, 4.1.
 *
 * Returns the target *node name* directly (rather than the raw 'A'/'B'/'C'
 * path letter that design.md's pseudocode maps through a `pathMap`) so that
 * `KeywordCurationGraph`'s `addConditionalEdges` call below can use an
 * identity-shaped `pathMap` (`{ commitMapping: 'commitMapping', ... }`) --
 * both are valid against `@langchain/langgraph@1.3.0`'s
 * `addConditionalEdges(source, path, pathMap?)` signature, which only
 * requires `path`'s return value to be a key of `pathMap`; this shape reads
 * more directly at the two call sites (this function and the graph
 * assembly) without losing any information design.md's version carried.
 *
 * A missing or unrecognized `humanDecision.path` is structurally impossible
 * -- `ai_failed` is an `AiRecommendation`-only variant and never becomes a
 * `HumanDecision` (graph.types.ts) -- so, like the commit nodes' own
 * "impossible state" guards (tasks 3.3-3.5), this throws rather than
 * returning a fallback route.
 */
export function routeByDecision(state: CurationState): CommitNodeName {
  const decision = state.humanDecision;
  switch (decision?.path) {
    case 'A':
      return 'commitMapping';
    case 'B':
      return 'validateAndCommitNewTech';
    case 'C':
      return 'commitKeywordBin';
    default:
      throw new Error(
        `routeByDecision requires state.humanDecision.path to be 'A', 'B', or 'C', got: ${JSON.stringify(decision)}`,
      );
  }
}

/**
 * design.md's `KeywordCurationGraph` section, "圖形組裝" code block (~lines
 * 393-415), requirements 2.1, 4.1: assembles and compiles the full 5-node
 * graph with conditional routing to the correct commit node, backed by a
 * `MemorySaver` checkpointer so `interrupt()`/`Command({ resume })` sessions
 * persist across separate `.invoke()` calls on the same `thread_id`.
 *
 * Constructor-injects the 5 already-`@Injectable()` node classes (tasks
 * 3.1-3.5) as a normal NestJS provider, mirroring their own DI shape.
 *
 * Exposes the compiled graph as a public `app` property (rather than
 * `invoke`/`resume` wrapper methods) so callers can use the exact
 * `app.invoke(initialState, config)` / `app.invoke(new Command({ resume }),
 * config)` calling convention design.md's "Session 操作" block (~lines
 * 417-431) documents -- this is the shape task 4.2 (`startSession` /
 * `resumeSession`, not yet built) is expected to consume:
 *   - `startSession(keyword)`: build a fresh `thread_id`, call
 *     `graph.app.invoke(<initial CurationState>, { configurable: { thread_id
 *     } })`, then read the interrupt payload off the returned value via
 *     `isInterrupted()` / `result[INTERRUPT][0].value` (same pattern as this
 *     file's own `ClassifyNode.node` tests, task 3.2).
 *   - `resumeSession(threadId, decision)`: call
 *     `graph.app.invoke(new Command({ resume: decision }), { configurable: {
 *     thread_id: threadId } })`, then read `result.commitResult` for the
 *     final `CommitResult`. If `threadId` is unknown to the `MemorySaver`,
 *     `graph.app.getState(config).next` comes back empty with no prior
 *     checkpoint -- task 4.2's 404 branch should check for that.
 */
@Injectable()
export class KeywordCurationGraph {
  readonly app;

  constructor(
    fetchContextNode: FetchContextNode,
    classifyNode: ClassifyNode,
    commitMappingNode: CommitMappingNode,
    validateAndCommitNewTechNode: ValidateAndCommitNewTechNode,
    commitKeywordBinNode: CommitKeywordBinNode,
  ) {
    const graph = new StateGraph(CurationAnnotation)
      .addNode('fetchContext', fetchContextNode.node)
      .addNode('classify', classifyNode.node)
      .addNode('commitMapping', commitMappingNode.node)
      .addNode('validateAndCommitNewTech', validateAndCommitNewTechNode.node)
      .addNode('commitKeywordBin', commitKeywordBinNode.node)
      .addEdge(START, 'fetchContext')
      .addEdge('fetchContext', 'classify')
      .addConditionalEdges('classify', routeByDecision, {
        commitMapping: 'commitMapping',
        validateAndCommitNewTech: 'validateAndCommitNewTech',
        commitKeywordBin: 'commitKeywordBin',
      })
      .addEdge('commitMapping', END)
      .addEdge('validateAndCommitNewTech', END)
      .addEdge('commitKeywordBin', END);

    this.app = graph.compile({ checkpointer: new MemorySaver() });
  }
}
