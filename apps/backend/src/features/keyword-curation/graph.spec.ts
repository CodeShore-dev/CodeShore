import 'reflect-metadata';

import {
  Command,
  END,
  INTERRUPT,
  isInterrupted,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { describe, expect, it, vi } from 'vitest';

import type { AiRecommendation, CurationState, HumanDecision, TechOption } from './graph.types';
import { ClassifyNode, CommitMappingNode, CurationAnnotation, FetchContextNode } from './graph';

interface FakeTechRow {
  id: string;
  label: string;
  category: string;
  [extra: string]: unknown;
}

function makeTechService(techRows: FakeTechRow[]) {
  return {
    fetchAll: vi
      .fn()
      .mockResolvedValue({ result: techRows, count: techRows.length, searchParams: '' }),
  };
}

function makeJobKeywordService(count: number) {
  return {
    fetchAll: vi.fn().mockResolvedValue({ result: [], count, searchParams: '' }),
  };
}

function baseState(overrides: Partial<CurationState> = {}): CurationState {
  return {
    keyword: 'reactjs',
    affectedJobCount: 0,
    allTechs: [],
    aiRecommendation: null,
    humanDecision: null,
    commitResult: null,
    ...overrides,
  };
}

/**
 * Task 3.1 completion criterion: unit test proves `FetchContextNode.node`
 * correctly populates `state.allTechs` (from `techService.fetchAll()`,
 * mapped to `TechOption`) and `state.affectedJobCount` (from the
 * `job_keyword` `cs`-operator count query, same pattern as
 * `KeywordMappingGenerator.countAffectedJobs`) -- requirements 2.1, 2.2.
 */
describe('FetchContextNode.node', () => {
  it('populates state.allTechs from techService.fetchAll(), mapped to {id, label, category} (requirement 2.1)', async () => {
    const techRows: FakeTechRow[] = [
      { id: 'react', label: 'React', category: 'frontend', icon_slugs: ['react'] },
      { id: 'vue', label: 'Vue', category: 'frontend' },
    ];
    const techService = makeTechService(techRows);
    const jobKeywordService = makeJobKeywordService(5);
    const node = new FetchContextNode(techService as any, jobKeywordService as any);

    const update = await node.node(baseState());

    expect(update.allTechs).toEqual<TechOption[]>([
      { id: 'react', label: 'React', category: 'frontend' },
      { id: 'vue', label: 'Vue', category: 'frontend' },
    ]);
    expect(techService.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('populates state.affectedJobCount from the job_keyword cs-operator count query for state.keyword (requirement 2.2)', async () => {
    const techService = makeTechService([]);
    const jobKeywordService = makeJobKeywordService(42);
    const node = new FetchContextNode(techService as any, jobKeywordService as any);

    const update = await node.node(baseState({ keyword: 'kubernetes' }));

    expect(update.affectedJobCount).toBe(42);
    expect(jobKeywordService.fetchAll).toHaveBeenCalledWith({
      where: { keywords: { cs: '{"kubernetes"}' } },
    });
  });

  it('returns an empty allTechs array and 0 affectedJobCount without error when both are empty (edge case)', async () => {
    const techService = makeTechService([]);
    const jobKeywordService = makeJobKeywordService(0);
    const node = new FetchContextNode(techService as any, jobKeywordService as any);

    const update = await node.node(baseState());

    expect(update).toEqual({ allTechs: [], affectedJobCount: 0 });
  });

  it('escapes quotes/backslashes in the keyword for the Postgres array-contains literal, matching KeywordMappingGenerator.countAffectedJobs', async () => {
    const techService = makeTechService([]);
    const jobKeywordService = makeJobKeywordService(1);
    const node = new FetchContextNode(techService as any, jobKeywordService as any);

    await node.node(baseState({ keyword: 'c++ "framework"' }));

    expect(jobKeywordService.fetchAll).toHaveBeenCalledWith({
      where: { keywords: { cs: '{"c++ \\"framework\\""}' } },
    });
  });

  it('fetches tech list and job count concurrently (independent queries, not sequential)', async () => {
    const techService = makeTechService([{ id: 'go', label: 'Go', category: 'language' }]);
    const jobKeywordService = makeJobKeywordService(7);
    const node = new FetchContextNode(techService as any, jobKeywordService as any);

    const update = await node.node(baseState({ keyword: 'golang' }));

    expect(update).toEqual({
      allTechs: [{ id: 'go', label: 'Go', category: 'language' }],
      affectedJobCount: 7,
    });
  });
});

function makeCurationLlmClassifier(recommendation: AiRecommendation) {
  return { classify: vi.fn().mockResolvedValue(recommendation) };
}

/**
 * Task 3.2 scope note: this is a throwaway, test-local graph -- NOT exported
 * from `graph.ts` -- wiring only `fetchContext -> classify -> END` with a
 * `MemorySaver` checkpointer. Its sole purpose is to exercise
 * `ClassifyNode.node`'s `interrupt()`/resume behavior through a real
 * compiled, checkpointed LangGraph invocation, since `interrupt()` only
 * functions correctly inside one (design.md's `KeywordCurationGraph` section,
 * ~lines 393-415). Tasks 3.3-3.5 (commit nodes) and 3.6 (the real full graph
 * with conditional routing to those commit nodes) are out of this task's
 * boundary and are NOT reproduced here.
 */
function buildFetchThenClassifyTestGraph(
  fetchContextNode: FetchContextNode,
  classifyNode: ClassifyNode,
) {
  const graph = new StateGraph(CurationAnnotation)
    .addNode('fetchContext', fetchContextNode.node)
    .addNode('classify', classifyNode.node)
    .addEdge(START, 'fetchContext')
    .addEdge('fetchContext', 'classify')
    .addEdge('classify', END);

  return graph.compile({ checkpointer: new MemorySaver() });
}

/**
 * Task 3.2 completion criteria (requirements 2.1, 2.3, 3.1-3.5): proves that
 * `graph.invoke()` pauses after the `classify` node with the
 * `AiRecommendation` (produced by `CurationLlmClassifier.classify()`,
 * including its `ai_failed` variant) surfaced as the interrupt payload, and
 * that resuming via `app.invoke(new Command({ resume: humanDecision }),
 * config)` with the same `thread_id` continues execution past `classify`
 * with `state.humanDecision` set to the resumed value.
 */
describe('ClassifyNode.node (via a minimal fetchContext -> classify -> END test graph)', () => {
  const techService = makeTechService([{ id: 'react', label: 'React', category: 'frontend' }]);
  const jobKeywordService = makeJobKeywordService(5);

  it('pauses graph execution after classify and surfaces the AiRecommendation as the interrupt payload (path A)', async () => {
    const recommendation: AiRecommendation = {
      path: 'A',
      matchedTech: { id: 'react', label: 'React', category: 'frontend' },
      confidence: 0.92,
      reasoning: 'reactjs is a common alias for React',
      affectedJobCount: 5,
    };
    const curationLlmClassifier = makeCurationLlmClassifier(recommendation);
    const app = buildFetchThenClassifyTestGraph(
      new FetchContextNode(techService as any, jobKeywordService as any),
      new ClassifyNode(curationLlmClassifier),
    );
    const config = { configurable: { thread_id: 'thread-path-a' } };

    const result = await app.invoke(baseState({ keyword: 'reactjs' }), config);

    expect(curationLlmClassifier.classify).toHaveBeenCalledWith('reactjs', 5, [
      { id: 'react', label: 'React', category: 'frontend' },
    ]);
    expect(isInterrupted<AiRecommendation>(result)).toBe(true);
    if (isInterrupted<AiRecommendation>(result)) {
      expect(result[INTERRUPT]).toHaveLength(1);
      expect(result[INTERRUPT][0].value).toEqual(recommendation);
    }
  });

  it('surfaces the ai_failed variant as the interrupt payload when CurationLlmClassifier.classify() resolves a degraded result (requirement 3.5)', async () => {
    const recommendation: AiRecommendation = { path: 'ai_failed', error: 'LLM request timed out' };
    const curationLlmClassifier = makeCurationLlmClassifier(recommendation);
    const app = buildFetchThenClassifyTestGraph(
      new FetchContextNode(techService as any, jobKeywordService as any),
      new ClassifyNode(curationLlmClassifier),
    );
    const config = { configurable: { thread_id: 'thread-ai-failed' } };

    const result = await app.invoke(baseState({ keyword: 'reactjs' }), config);

    expect(isInterrupted<AiRecommendation>(result)).toBe(true);
    if (isInterrupted<AiRecommendation>(result)) {
      expect(result[INTERRUPT][0].value).toEqual(recommendation);
    }
  });

  it('continues past classify to END with state.humanDecision set when resumed via Command({resume}) on the same thread_id', async () => {
    const recommendation: AiRecommendation = {
      path: 'C',
      reasoning: 'not a real technology',
      affectedJobCount: 5,
    };
    const curationLlmClassifier = makeCurationLlmClassifier(recommendation);
    const app = buildFetchThenClassifyTestGraph(
      new FetchContextNode(techService as any, jobKeywordService as any),
      new ClassifyNode(curationLlmClassifier),
    );
    const config = { configurable: { thread_id: 'thread-resume' } };
    const humanDecision: HumanDecision = { path: 'C' };

    const paused = await app.invoke(baseState({ keyword: 'asdf' }), config);
    expect(isInterrupted<AiRecommendation>(paused)).toBe(true);

    const resumed = await app.invoke(new Command({ resume: humanDecision }), config);

    expect(isInterrupted(resumed)).toBe(false);
    expect(resumed.aiRecommendation).toEqual(recommendation);
    expect(resumed.humanDecision).toEqual(humanDecision);
  });

  it('produces different interrupt payloads for two concurrent sessions (distinct thread_ids do not cross-contaminate)', async () => {
    const recommendationOne: AiRecommendation = {
      path: 'C',
      reasoning: 'noise',
      affectedJobCount: 5,
    };
    const recommendationTwo: AiRecommendation = {
      path: 'C',
      reasoning: 'also noise',
      affectedJobCount: 5,
    };
    const classifierOne = makeCurationLlmClassifier(recommendationOne);
    const classifierTwo = makeCurationLlmClassifier(recommendationTwo);
    const appOne = buildFetchThenClassifyTestGraph(
      new FetchContextNode(techService as any, jobKeywordService as any),
      new ClassifyNode(classifierOne),
    );
    const appTwo = buildFetchThenClassifyTestGraph(
      new FetchContextNode(techService as any, jobKeywordService as any),
      new ClassifyNode(classifierTwo),
    );
    const configOne = { configurable: { thread_id: 'thread-one' } };
    const configTwo = { configurable: { thread_id: 'thread-two' } };

    const resultOne = await appOne.invoke(baseState({ keyword: 'foo' }), configOne);
    const resultTwo = await appTwo.invoke(baseState({ keyword: 'bar' }), configTwo);

    expect(isInterrupted<AiRecommendation>(resultOne)).toBe(true);
    expect(isInterrupted<AiRecommendation>(resultTwo)).toBe(true);
    if (isInterrupted<AiRecommendation>(resultOne) && isInterrupted<AiRecommendation>(resultTwo)) {
      expect(resultOne[INTERRUPT][0].value).toEqual(recommendationOne);
      expect(resultTwo[INTERRUPT][0].value).toEqual(recommendationTwo);
    }
  });
});

function makeTechKeywordService(error: { message?: string } | null = null) {
  return {
    upsert: vi.fn().mockResolvedValue({ error }),
  };
}

/**
 * Task 3.3 completion criterion: unit test with a mocked `TechKeywordService`
 * proves `CommitMappingNode.node` calls `upsert()` with the confirmed
 * tech/keyword pair and returns a `CommitResult` reflecting the outcome
 * (requirements 5.2, 5.3; design.md's `KeywordCurationGraph` section, Node
 * 4a `commitMapping` pseudocode, ~lines 378-379).
 */
describe('CommitMappingNode.node', () => {
  it('calls techKeywordService.upsert with the confirmed tech/keyword pair and returns CommitResult.ok: true (requirement 5.2)', async () => {
    const techKeywordService = makeTechKeywordService(null);
    const node = new CommitMappingNode(techKeywordService as any);
    const humanDecision: HumanDecision = { path: 'A', confirmedTechId: 'react' };

    const update = await node.node(
      baseState({ keyword: 'reactjs', humanDecision }),
    );

    expect(techKeywordService.upsert).toHaveBeenCalledWith([
      { tech: 'react', keyword: 'reactjs' },
    ]);
    expect(update.commitResult).toEqual({
      ok: true,
      changes: [
        {
          type: 'tech_keyword',
          details: { keyword: 'reactjs', tech: 'react' },
          status: 'committed',
        },
      ],
    });
  });

  it('returns CommitResult.ok: false with partialChanges: [] when the upsert fails (design.md requirement 9.1 error-handling table)', async () => {
    const techKeywordService = makeTechKeywordService({ message: 'duplicate key value' });
    const node = new CommitMappingNode(techKeywordService as any);
    const humanDecision: HumanDecision = { path: 'A', confirmedTechId: 'react' };

    const update = await node.node(
      baseState({ keyword: 'reactjs', humanDecision }),
    );

    expect(update.commitResult).toEqual({
      ok: false,
      error: 'duplicate key value',
      partialChanges: [],
    });
  });

  it('throws when reached with a non-path-A (or missing) humanDecision, since this node should only be routed to when decision.path === A', async () => {
    const techKeywordService = makeTechKeywordService(null);
    const node = new CommitMappingNode(techKeywordService as any);

    await expect(
      node.node(baseState({ keyword: 'reactjs', humanDecision: { path: 'C' } })),
    ).rejects.toThrow(/humanDecision\.path/);
    await expect(
      node.node(baseState({ keyword: 'reactjs', humanDecision: null })),
    ).rejects.toThrow(/humanDecision\.path/);
    expect(techKeywordService.upsert).not.toHaveBeenCalled();
  });
});
