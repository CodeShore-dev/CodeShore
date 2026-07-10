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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectTechParentCycle } from '../ai-suggestion/validation/cycle-check';
import type { AiRecommendation, CurationState, HumanDecision, TechOption } from './graph.types';
import {
  ClassifyNode,
  CommitKeywordBinNode,
  CommitMappingNode,
  CurationAnnotation,
  FetchContextNode,
  ValidateAndCommitNewTechNode,
} from './graph';

// `vi.mock` calls are hoisted above all imports by vitest, so this applies
// before `ValidateAndCommitNewTechNode`'s module-level `import {
// detectTechParentCycle }` (in graph.ts) resolves, regardless of source
// order here.
vi.mock('../ai-suggestion/validation/cycle-check', () => ({
  detectTechParentCycle: vi.fn(),
}));

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

interface FakeExistingTechRow {
  id: string;
  [extra: string]: unknown;
}

function makeTechServiceForCommit(
  options: {
    existing?: FakeExistingTechRow[];
    upsertError?: { message?: string } | null;
  } = {},
) {
  const existing = options.existing ?? [];
  return {
    fetchAll: vi
      .fn()
      .mockResolvedValue({ result: existing, count: existing.length, searchParams: '' }),
    upsert: vi.fn().mockResolvedValue({ error: options.upsertError ?? null }),
  };
}

function makeTechKeywordServiceForCommit(error: { message?: string } | null = null) {
  return { upsert: vi.fn().mockResolvedValue({ error }) };
}

function makeTechParentServiceForCommit(error: { message?: string } | null = null) {
  return { upsert: vi.fn().mockResolvedValue({ error }) };
}

/**
 * Task 3.4 completion criteria (requirements 6.5, 6.7, 6.8, 9.3; design.md's
 * `KeywordCurationGraph` section, Node 4b `validateAndCommitNewTech`
 * pseudocode ~lines 381-387, and error-handling table ~lines 631-640): unit
 * tests with mocked `TechService`/`TechKeywordService`/`TechParentService`
 * and a mocked `detectTechParentCycle` prove the three-write commit
 * sequence, its cycle/duplicate-id abort paths, and its "continue past
 * individual step failure" partial-success behavior.
 */
describe('ValidateAndCommitNewTechNode.node', () => {
  const newTech: HumanDecision & { path: 'B' } = {
    path: 'B',
    newTech: {
      id: 'svelte',
      label: 'Svelte',
      category: 'frontend',
      iconSlugs: ['svelte'],
      tags: ['javascript', 'frontend'],
    },
    confirmedEdges: [
      { parentId: 'javascript', childId: 'svelte' },
      { parentId: 'frontend', childId: 'svelte' },
    ],
  };

  beforeEach(() => {
    vi.mocked(detectTechParentCycle).mockReset();
  });

  it('commits tech, tech_keyword, and one tech_parent entry per confirmed edge when everything succeeds (requirements 6.7, 9.3)', async () => {
    vi.mocked(detectTechParentCycle).mockResolvedValue({ hasCycle: false });
    const techService = makeTechServiceForCommit();
    const techKeywordService = makeTechKeywordServiceForCommit(null);
    const techParentService = makeTechParentServiceForCommit(null);
    const node = new ValidateAndCommitNewTechNode(
      techService as any,
      techKeywordService as any,
      techParentService as any,
    );

    const update = await node.node(baseState({ keyword: 'sveltejs', humanDecision: newTech }));

    expect(detectTechParentCycle).toHaveBeenCalledWith('javascript', 'svelte');
    expect(detectTechParentCycle).toHaveBeenCalledWith('frontend', 'svelte');
    expect(techService.upsert).toHaveBeenCalledWith([
      {
        id: 'svelte',
        label: 'Svelte',
        category: 'frontend',
        icon_slugs: ['svelte'],
        tags: ['javascript', 'frontend'],
      },
    ]);
    expect(techKeywordService.upsert).toHaveBeenCalledWith([
      { tech: 'svelte', keyword: 'sveltejs' },
    ]);
    expect(techParentService.upsert).toHaveBeenCalledTimes(2);
    expect(techParentService.upsert).toHaveBeenCalledWith([
      { parent: 'javascript', child: 'svelte' },
    ]);
    expect(techParentService.upsert).toHaveBeenCalledWith([{ parent: 'frontend', child: 'svelte' }]);

    expect(update.commitResult).toEqual({
      ok: true,
      changes: [
        {
          type: 'tech',
          details: { id: 'svelte', label: 'Svelte', category: 'frontend' },
          status: 'committed',
        },
        {
          type: 'tech_keyword',
          details: { tech: 'svelte', keyword: 'sveltejs' },
          status: 'committed',
        },
        {
          type: 'tech_parent',
          details: { parent: 'javascript', child: 'svelte' },
          status: 'committed',
        },
        {
          type: 'tech_parent',
          details: { parent: 'frontend', child: 'svelte' },
          status: 'committed',
        },
      ],
    });
  });

  it('aborts the whole commit with no writes when detectTechParentCycle reports a cycle on any edge (requirement 6.5)', async () => {
    vi.mocked(detectTechParentCycle).mockImplementation(async (parent: string) => {
      if (parent === 'frontend') return { hasCycle: true, conflictPath: ['svelte', 'frontend'] };
      return { hasCycle: false };
    });
    const techService = makeTechServiceForCommit();
    const techKeywordService = makeTechKeywordServiceForCommit(null);
    const techParentService = makeTechParentServiceForCommit(null);
    const node = new ValidateAndCommitNewTechNode(
      techService as any,
      techKeywordService as any,
      techParentService as any,
    );

    const update = await node.node(baseState({ keyword: 'sveltejs', humanDecision: newTech }));

    expect(update.commitResult).toEqual({
      ok: false,
      error: 'cycle_detected',
      partialChanges: [],
    });
    expect(techService.upsert).not.toHaveBeenCalled();
    expect(techKeywordService.upsert).not.toHaveBeenCalled();
    expect(techParentService.upsert).not.toHaveBeenCalled();
  });

  it('records tech (committed) and tech_keyword (failed) in partialChanges and still attempts tech_parent writes when tech_keyword fails (requirement 9.3)', async () => {
    vi.mocked(detectTechParentCycle).mockResolvedValue({ hasCycle: false });
    const techService = makeTechServiceForCommit();
    const techKeywordService = makeTechKeywordServiceForCommit({
      message: 'tech_keyword insert failed',
    });
    const techParentService = makeTechParentServiceForCommit(null);
    const node = new ValidateAndCommitNewTechNode(
      techService as any,
      techKeywordService as any,
      techParentService as any,
    );

    const update = await node.node(baseState({ keyword: 'sveltejs', humanDecision: newTech }));

    expect(techParentService.upsert).toHaveBeenCalledTimes(2);
    expect(update.commitResult?.ok).toBe(false);
    if (update.commitResult?.ok === false) {
      expect(update.commitResult.partialChanges).toContainEqual({
        type: 'tech',
        details: { id: 'svelte', label: 'Svelte', category: 'frontend' },
        status: 'committed',
      });
      expect(update.commitResult.partialChanges).toContainEqual({
        type: 'tech_keyword',
        details: { tech: 'svelte', keyword: 'sveltejs' },
        status: 'failed',
        error: 'tech_keyword insert failed',
      });
      expect(update.commitResult.partialChanges).toContainEqual({
        type: 'tech_parent',
        details: { parent: 'javascript', child: 'svelte' },
        status: 'committed',
      });
      expect(update.commitResult.partialChanges).toContainEqual({
        type: 'tech_parent',
        details: { parent: 'frontend', child: 'svelte' },
        status: 'committed',
      });
      expect(update.commitResult.partialChanges).toHaveLength(4);
    }
  });

  it('aborts the whole commit with no writes when the new tech id already exists (requirement 6.8)', async () => {
    vi.mocked(detectTechParentCycle).mockResolvedValue({ hasCycle: false });
    const techService = makeTechServiceForCommit({ existing: [{ id: 'svelte' }] });
    const techKeywordService = makeTechKeywordServiceForCommit(null);
    const techParentService = makeTechParentServiceForCommit(null);
    const node = new ValidateAndCommitNewTechNode(
      techService as any,
      techKeywordService as any,
      techParentService as any,
    );

    const update = await node.node(baseState({ keyword: 'sveltejs', humanDecision: newTech }));

    expect(techService.fetchAll).toHaveBeenCalledWith({ where: { id: { eq: 'svelte' } } });
    expect(update.commitResult).toEqual({
      ok: false,
      error: 'duplicate_id',
      partialChanges: [],
    });
    expect(techService.upsert).not.toHaveBeenCalled();
    expect(techKeywordService.upsert).not.toHaveBeenCalled();
    expect(techParentService.upsert).not.toHaveBeenCalled();
  });

  it('commits tech and tech_keyword with zero tech_parent writes when confirmedEdges is empty (edge case)', async () => {
    const techService = makeTechServiceForCommit();
    const techKeywordService = makeTechKeywordServiceForCommit(null);
    const techParentService = makeTechParentServiceForCommit(null);
    const node = new ValidateAndCommitNewTechNode(
      techService as any,
      techKeywordService as any,
      techParentService as any,
    );
    const decision: HumanDecision = {
      path: 'B',
      newTech: newTech.newTech,
      confirmedEdges: [],
    };

    const update = await node.node(baseState({ keyword: 'sveltejs', humanDecision: decision }));

    expect(detectTechParentCycle).not.toHaveBeenCalled();
    expect(techParentService.upsert).not.toHaveBeenCalled();
    expect(update.commitResult).toEqual({
      ok: true,
      changes: [
        {
          type: 'tech',
          details: { id: 'svelte', label: 'Svelte', category: 'frontend' },
          status: 'committed',
        },
        {
          type: 'tech_keyword',
          details: { tech: 'svelte', keyword: 'sveltejs' },
          status: 'committed',
        },
      ],
    });
  });

  it('throws when reached with a non-path-B (or missing) humanDecision, since this node should only be routed to when decision.path === B', async () => {
    const techService = makeTechServiceForCommit();
    const techKeywordService = makeTechKeywordServiceForCommit(null);
    const techParentService = makeTechParentServiceForCommit(null);
    const node = new ValidateAndCommitNewTechNode(
      techService as any,
      techKeywordService as any,
      techParentService as any,
    );

    await expect(
      node.node(baseState({ keyword: 'sveltejs', humanDecision: { path: 'C' } })),
    ).rejects.toThrow(/humanDecision\.path/);
    await expect(
      node.node(baseState({ keyword: 'sveltejs', humanDecision: null })),
    ).rejects.toThrow(/humanDecision\.path/);
    expect(techService.upsert).not.toHaveBeenCalled();
  });
});

function makeKeywordBinService(error: { message?: string } | null = null) {
  return {
    upsert: vi.fn().mockResolvedValue({ error }),
  };
}

/**
 * Task 3.5 completion criterion: unit test with a mocked `KeywordBinService`
 * proves `CommitKeywordBinNode.node` calls `upsert()` with the keyword and
 * returns a `CommitResult` reflecting the outcome (requirement 7.2; design.md's
 * `KeywordCurationGraph` section, Node 4c `commitKeywordBin` pseudocode,
 * ~lines 389-390).
 */
describe('CommitKeywordBinNode.node', () => {
  it('calls keywordBinService.upsert with the keyword and returns CommitResult.ok: true (requirement 7.2)', async () => {
    const keywordBinService = makeKeywordBinService(null);
    const node = new CommitKeywordBinNode(keywordBinService as any);
    const humanDecision: HumanDecision = { path: 'C' };

    const update = await node.node(baseState({ keyword: 'blockchain', humanDecision }));

    expect(keywordBinService.upsert).toHaveBeenCalledWith([{ id: 'blockchain' }]);
    expect(update.commitResult).toEqual({
      ok: true,
      changes: [
        {
          type: 'keyword_bin',
          details: { id: 'blockchain' },
          status: 'committed',
        },
      ],
    });
  });

  it('returns CommitResult.ok: false with partialChanges: [] when the upsert fails', async () => {
    const keywordBinService = makeKeywordBinService({ message: 'duplicate key value' });
    const node = new CommitKeywordBinNode(keywordBinService as any);
    const humanDecision: HumanDecision = { path: 'C' };

    const update = await node.node(baseState({ keyword: 'blockchain', humanDecision }));

    expect(update.commitResult).toEqual({
      ok: false,
      error: 'duplicate key value',
      partialChanges: [],
    });
  });

  it('throws when reached with a non-path-C (or missing) humanDecision, since this node should only be routed to when decision.path === C', async () => {
    const keywordBinService = makeKeywordBinService(null);
    const node = new CommitKeywordBinNode(keywordBinService as any);

    await expect(
      node.node(
        baseState({ keyword: 'blockchain', humanDecision: { path: 'A', confirmedTechId: 'react' } }),
      ),
    ).rejects.toThrow(/humanDecision\.path/);
    await expect(
      node.node(baseState({ keyword: 'blockchain', humanDecision: null })),
    ).rejects.toThrow(/humanDecision\.path/);
    expect(keywordBinService.upsert).not.toHaveBeenCalled();
  });
});
