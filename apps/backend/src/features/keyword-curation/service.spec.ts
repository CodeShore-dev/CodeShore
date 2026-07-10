import { describe, expect, it, vi } from 'vitest';

import type { AiRecommendation, HumanDecision } from './graph.types';
import {
  ClassifyNode,
  CommitKeywordBinNode,
  CommitMappingNode,
  FetchContextNode,
  KeywordCurationGraph,
  ValidateAndCommitNewTechNode,
} from './graph';
import { KEYWORD_COUNT_THRESHOLD, Service } from './service';

/**
 * Builds a `Service` with constructor-injected fakes, following
 * `ai-suggestion/service.spec.ts`'s established `createService(overrides)`
 * convention. Every dependency defaults to an empty stub object so tests
 * that don't exercise a given data-utils service don't need to know about
 * it. `graph` defaults to a stub with no-op `app.invoke`/`app.getState`
 * spies for tests that don't exercise `startSession`/`resumeSession`
 * (task 4.2).
 */
function createService(
  overrides: {
    keywordService?: any;
    techKeywordService?: any;
    keywordBinService?: any;
    jobKeywordService?: any;
    graph?: any;
  } = {},
): Service {
  return new Service(
    overrides.keywordService ?? {},
    overrides.techKeywordService ?? {},
    overrides.keywordBinService ?? {},
    overrides.jobKeywordService ?? {},
    overrides.graph ?? { app: { invoke: vi.fn(), getState: vi.fn() } },
  ) as any;
}

/** `job_keyword.fetchAll` stub returning a fixed `count` for every keyword. */
function jobKeywordServiceWithCounts(
  counts: Record<string, number>,
): { fetchAll: ReturnType<typeof vi.fn> } {
  return {
    fetchAll: vi.fn().mockImplementation(async ({ where }: any) => {
      // `where.keywords.cs` is a pg-array literal like `{"react"}` -- pull
      // the keyword back out to look up its configured count.
      const literal: string = where.keywords.cs;
      const keyword = literal.slice(2, -2);
      return { result: [], count: counts[keyword] ?? 0, searchParams: '' };
    }),
  };
}

describe('Service.getQueue', () => {
  it('excludes a keyword already mapped in tech_keyword even though it is above threshold and not in keyword_bin', async () => {
    const keywordService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [
          { id: 'react', count: 50 },
          { id: 'golang', count: 20 },
        ],
        count: 2,
        searchParams: '',
      }),
    };
    const techKeywordService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [{ tech: 'react', keyword: 'react' }],
        count: 1,
        searchParams: '',
      }),
    };
    const keywordBinService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const jobKeywordService = jobKeywordServiceWithCounts({ golang: 12 });
    const service = createService({
      keywordService,
      techKeywordService,
      keywordBinService,
      jobKeywordService,
    });

    const result = await service.getQueue();

    expect(result.keywords.map(keyword => keyword.id)).toEqual(['golang']);
    expect(result.keywords).not.toContainEqual(
      expect.objectContaining({ id: 'react' }),
    );
  });

  it('excludes a keyword already present in keyword_bin even though it is above threshold and unmapped', async () => {
    const keywordService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [
          { id: 'noise-word', count: 30 },
          { id: 'golang', count: 20 },
        ],
        count: 2,
        searchParams: '',
      }),
    };
    const techKeywordService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const keywordBinService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [{ id: 'noise-word' }],
        count: 1,
        searchParams: '',
      }),
    };
    const jobKeywordService = jobKeywordServiceWithCounts({ golang: 12 });
    const service = createService({
      keywordService,
      techKeywordService,
      keywordBinService,
      jobKeywordService,
    });

    const result = await service.getQueue();

    expect(result.keywords.map(keyword => keyword.id)).toEqual(['golang']);
    expect(result.keywords).not.toContainEqual(
      expect.objectContaining({ id: 'noise-word' }),
    );
  });

  it('excludes a keyword below KEYWORD_COUNT_THRESHOLD even though it is unmapped and not in keyword_bin', async () => {
    expect(KEYWORD_COUNT_THRESHOLD).toBe(10);
    const keywordService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [
          { id: 'rare-word', count: 9 },
          { id: 'golang', count: 20 },
        ],
        count: 2,
        searchParams: '',
      }),
    };
    const techKeywordService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const keywordBinService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const jobKeywordService = jobKeywordServiceWithCounts({ golang: 12 });
    const service = createService({
      keywordService,
      techKeywordService,
      keywordBinService,
      jobKeywordService,
    });

    const result = await service.getQueue();

    expect(result.keywords.map(keyword => keyword.id)).toEqual(['golang']);
    expect(result.keywords).not.toContainEqual(
      expect.objectContaining({ id: 'rare-word' }),
    );
  });

  it('returns results sorted by count descending', async () => {
    const keywordService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [
          { id: 'low', count: 10 },
          { id: 'high', count: 100 },
          { id: 'mid', count: 40 },
        ],
        count: 3,
        searchParams: '',
      }),
    };
    const techKeywordService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const keywordBinService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const jobKeywordService = jobKeywordServiceWithCounts({
      low: 1,
      high: 2,
      mid: 3,
    });
    const service = createService({
      keywordService,
      techKeywordService,
      keywordBinService,
      jobKeywordService,
    });

    const result = await service.getQueue();

    expect(result.keywords.map(keyword => keyword.id)).toEqual([
      'high',
      'mid',
      'low',
    ]);
  });

  it('includes the correct affectedJobCount for each returned keyword from the job_keyword count query', async () => {
    const keywordService = {
      fetchAll: vi.fn().mockResolvedValue({
        result: [
          { id: 'react', count: 50 },
          { id: 'golang', count: 20 },
        ],
        count: 2,
        searchParams: '',
      }),
    };
    const techKeywordService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const keywordBinService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const jobKeywordService = jobKeywordServiceWithCounts({
      react: 42,
      golang: 7,
    });
    const service = createService({
      keywordService,
      techKeywordService,
      keywordBinService,
      jobKeywordService,
    });

    const result = await service.getQueue();

    expect(result.keywords).toEqual([
      { id: 'react', count: 50, affectedJobCount: 42 },
      { id: 'golang', count: 20, affectedJobCount: 7 },
    ]);
    expect(jobKeywordService.fetchAll).toHaveBeenCalledWith({
      where: { keywords: { cs: '{"react"}' } },
    });
    expect(jobKeywordService.fetchAll).toHaveBeenCalledWith({
      where: { keywords: { cs: '{"golang"}' } },
    });
  });

  it('returns an empty keywords array when no keyword qualifies (requirement 1.3)', async () => {
    const keywordService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const techKeywordService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const keywordBinService = {
      fetchAll: vi.fn().mockResolvedValue({ result: [], count: 0, searchParams: '' }),
    };
    const jobKeywordService = { fetchAll: vi.fn() };
    const service = createService({
      keywordService,
      techKeywordService,
      keywordBinService,
      jobKeywordService,
    });

    const result = await service.getQueue();

    expect(result).toEqual({ keywords: [] });
    expect(jobKeywordService.fetchAll).not.toHaveBeenCalled();
  });
});

interface FakeTechRow {
  id: string;
  label: string;
  category: string;
  [extra: string]: unknown;
}

function makeGraphTechService(techRows: FakeTechRow[] = []) {
  return {
    fetchAll: vi
      .fn()
      .mockResolvedValue({ result: techRows, count: techRows.length, searchParams: '' }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
}

function makeGraphJobKeywordService(count: number) {
  return { fetchAll: vi.fn().mockResolvedValue({ result: [], count, searchParams: '' }) };
}

function makeGraphUpsertService(error: { message?: string } | null = null) {
  return { upsert: vi.fn().mockResolvedValue({ error }) };
}

/**
 * Builds a REAL, compiled `KeywordCurationGraph` (real `StateGraph` +
 * `MemorySaver` + `interrupt()`/`Command`), with only the underlying
 * data-utils services mocked -- mirroring `graph.spec.ts`'s own
 * `makeGraphNodes`/`buildGraph` helpers. Task 4.2's completion criterion
 * explicitly calls for exercising the real compiled graph through the
 * `Service` layer (not a mocked `KeywordCurationGraph`), since that's what
 * actually proves the threadId-based pause/resume mechanism works, not just
 * that `Service` calls whatever mock it's given correctly.
 */
function buildRealGraph(recommendationsByKeyword: Record<string, AiRecommendation>) {
  const techService = makeGraphTechService([{ id: 'react', label: 'React', category: 'frontend' }]);
  const jobKeywordService = makeGraphJobKeywordService(5);
  const curationLlmClassifier = {
    classify: vi.fn(async (keyword: string) => {
      const recommendation = recommendationsByKeyword[keyword];
      if (!recommendation) {
        throw new Error(`No fixture AiRecommendation configured for keyword "${keyword}"`);
      }
      return recommendation;
    }),
  };
  const commitMappingTechKeywordService = makeGraphUpsertService(null);
  const validateTechService = makeGraphTechService([]);
  const validateTechKeywordService = makeGraphUpsertService(null);
  const validateTechParentService = makeGraphUpsertService(null);
  const keywordBinService = makeGraphUpsertService(null);

  const graph = new KeywordCurationGraph(
    new FetchContextNode(techService as any, jobKeywordService as any),
    new ClassifyNode(curationLlmClassifier),
    new CommitMappingNode(commitMappingTechKeywordService as any),
    new ValidateAndCommitNewTechNode(
      validateTechService as any,
      validateTechKeywordService as any,
      validateTechParentService as any,
    ),
    new CommitKeywordBinNode(keywordBinService as any),
  );

  return {
    graph,
    spies: {
      commitMappingTechKeywordService,
      validateTechService,
      validateTechKeywordService,
      validateTechParentService,
      keywordBinService,
    },
  };
}

/**
 * Task 4.2 completion criterion: "integration test 驗證完整 A/B/C 三路
 * start→resume 流程各產生正確 CommitResult" -- exercised against a REAL
 * compiled `KeywordCurationGraph` (see `buildRealGraph` above), not a mocked
 * one, since that's what actually proves the threadId-based
 * `startSession`/`resumeSession` pause-resume mechanism genuinely works
 * through the `Service` layer.
 */
describe('Service.startSession / Service.resumeSession (integration, real KeywordCurationGraph)', () => {
  it('completes the full path A start -> resume flow with the correct CommitResult (requirements 2.1, 5.2, 5.3)', async () => {
    const recommendation: AiRecommendation = {
      path: 'A',
      matchedTech: { id: 'react', label: 'React', category: 'frontend' },
      confidence: 0.92,
      reasoning: 'reactjs is a common alias for React',
      affectedJobCount: 5,
    };
    const { graph, spies } = buildRealGraph({ reactjs: recommendation });
    const service = createService({ graph });

    const startResult = await service.startSession('reactjs');

    expect(startResult.ok).toBe(true);
    if (!startResult.ok) throw new Error('expected startSession to succeed');
    expect(startResult.interrupt).toEqual(recommendation);
    expect(typeof startResult.threadId).toBe('string');
    expect(startResult.threadId.length).toBeGreaterThan(0);

    const decision: HumanDecision = { path: 'A', confirmedTechId: 'react' };
    const resumeResult = await service.resumeSession(startResult.threadId, decision);

    expect(resumeResult.ok).toBe(true);
    if (!resumeResult.ok) throw new Error('expected resumeSession to succeed');
    expect(resumeResult.result).toEqual({
      ok: true,
      changes: [
        { type: 'tech_keyword', details: { keyword: 'reactjs', tech: 'react' }, status: 'committed' },
      ],
    });
    expect(spies.commitMappingTechKeywordService.upsert).toHaveBeenCalledWith([
      { tech: 'react', keyword: 'reactjs' },
    ]);
  });

  it('completes the full path B start -> resume flow with the correct CommitResult (requirement 6.7)', async () => {
    const recommendation: AiRecommendation = {
      path: 'B',
      suggestedTech: { id: 'svelte', label: 'Svelte', category: 'frontend', tags: [], iconSlugs: [] },
      suggestedEdges: [],
      reasoning: 'no existing match',
      affectedJobCount: 5,
    };
    const { graph, spies } = buildRealGraph({ sveltejs: recommendation });
    const service = createService({ graph });

    const startResult = await service.startSession('sveltejs');

    expect(startResult.ok).toBe(true);
    if (!startResult.ok) throw new Error('expected startSession to succeed');
    expect(startResult.interrupt).toEqual(recommendation);

    const decision: HumanDecision = {
      path: 'B',
      newTech: { id: 'svelte', label: 'Svelte', category: 'frontend', iconSlugs: [], tags: [] },
      confirmedEdges: [],
    };
    const resumeResult = await service.resumeSession(startResult.threadId, decision);

    expect(resumeResult.ok).toBe(true);
    if (!resumeResult.ok) throw new Error('expected resumeSession to succeed');
    expect(resumeResult.result).toEqual({
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
    expect(spies.validateTechService.upsert).toHaveBeenCalledWith([
      { id: 'svelte', label: 'Svelte', category: 'frontend', icon_slugs: [], tags: [] },
    ]);
  });

  it('completes the full path C start -> resume flow with the correct CommitResult (requirement 7.2)', async () => {
    const recommendation: AiRecommendation = {
      path: 'C',
      reasoning: 'not a real technology',
      affectedJobCount: 5,
    };
    const { graph, spies } = buildRealGraph({ blockchain: recommendation });
    const service = createService({ graph });

    const startResult = await service.startSession('blockchain');

    expect(startResult.ok).toBe(true);
    if (!startResult.ok) throw new Error('expected startSession to succeed');
    expect(startResult.interrupt).toEqual(recommendation);

    const decision: HumanDecision = { path: 'C' };
    const resumeResult = await service.resumeSession(startResult.threadId, decision);

    expect(resumeResult.ok).toBe(true);
    if (!resumeResult.ok) throw new Error('expected resumeSession to succeed');
    expect(resumeResult.result).toEqual({
      ok: true,
      changes: [{ type: 'keyword_bin', details: { id: 'blockchain' }, status: 'committed' }],
    });
    expect(spies.keywordBinService.upsert).toHaveBeenCalledWith([{ id: 'blockchain' }]);
  });

  it('surfaces the ai_failed interrupt payload and still completes commit on resumeSession with a manually-chosen decision (requirements 3.5, 9.2)', async () => {
    const recommendation: AiRecommendation = { path: 'ai_failed', error: 'LLM request timed out' };
    const { graph, spies } = buildRealGraph({ 'weird-keyword': recommendation });
    const service = createService({ graph });

    const startResult = await service.startSession('weird-keyword');

    expect(startResult.ok).toBe(true);
    if (!startResult.ok) throw new Error('expected startSession to succeed');
    expect(startResult.interrupt).toEqual({ path: 'ai_failed', error: 'LLM request timed out' });

    // Requirement 9.2: the admin manually picks a path despite the AI
    // failure -- here path C, chosen without relying on any AI suggestion.
    const decision: HumanDecision = { path: 'C' };
    const resumeResult = await service.resumeSession(startResult.threadId, decision);

    expect(resumeResult.ok).toBe(true);
    if (!resumeResult.ok) throw new Error('expected resumeSession to succeed');
    expect(resumeResult.result).toEqual({
      ok: true,
      changes: [{ type: 'keyword_bin', details: { id: 'weird-keyword' }, status: 'committed' }],
    });
    expect(spies.keywordBinService.upsert).toHaveBeenCalledWith([{ id: 'weird-keyword' }]);
  });

  it('returns { ok: false, error: "thread_not_found" } from resumeSession when threadId was never started', async () => {
    const { graph } = buildRealGraph({});
    const service = createService({ graph });

    const result = await service.resumeSession('does-not-exist', { path: 'C' });

    expect(result).toEqual({
      ok: false,
      error: 'thread_not_found',
      message: expect.stringContaining('does-not-exist'),
    });
  });

  it('does not resolve a second, independent session started afterwards to thread_not_found (real MemorySaver isolation across two startSession calls)', async () => {
    const recommendationOne: AiRecommendation = { path: 'C', reasoning: 'noise-one', affectedJobCount: 1 };
    const recommendationTwo: AiRecommendation = { path: 'C', reasoning: 'noise-two', affectedJobCount: 2 };
    const { graph } = buildRealGraph({ 'keyword-one': recommendationOne, 'keyword-two': recommendationTwo });
    const service = createService({ graph });

    const startOne = await service.startSession('keyword-one');
    const startTwo = await service.startSession('keyword-two');
    expect(startOne.ok).toBe(true);
    expect(startTwo.ok).toBe(true);
    if (!startOne.ok || !startTwo.ok) throw new Error('expected both startSession calls to succeed');
    expect(startOne.threadId).not.toBe(startTwo.threadId);

    const resumeOne = await service.resumeSession(startOne.threadId, { path: 'C' });
    const resumeTwo = await service.resumeSession(startTwo.threadId, { path: 'C' });

    expect(resumeOne.ok).toBe(true);
    expect(resumeTwo.ok).toBe(true);
    if (!resumeOne.ok || !resumeTwo.ok) throw new Error('expected both resumeSession calls to succeed');
    expect(resumeOne.result).toEqual({
      ok: true,
      changes: [{ type: 'keyword_bin', details: { id: 'keyword-one' }, status: 'committed' }],
    });
    expect(resumeTwo.result).toEqual({
      ok: true,
      changes: [{ type: 'keyword_bin', details: { id: 'keyword-two' }, status: 'committed' }],
    });
  });
});

/**
 * Unit-level tests for `startSession`/`resumeSession`'s own error-wrapping
 * branches, using a mocked `KeywordCurationGraph` -- complements the
 * real-graph integration tests above, which cannot easily trigger an
 * unexpected `app.invoke()` throw or a malformed graph result.
 */
describe('Service.startSession (mocked graph, error branches)', () => {
  it('returns { ok: false, error } when graph.app.invoke throws', async () => {
    const graph = {
      app: {
        invoke: vi.fn().mockRejectedValue(new Error('db exploded')),
        getState: vi.fn(),
      },
    };
    const service = createService({ graph });

    const result = await service.startSession('reactjs');

    expect(result).toEqual({ ok: false, error: 'db exploded' });
  });

  it('returns { ok: false, error } when the graph does not pause at an interrupt as expected', async () => {
    const graph = {
      app: {
        invoke: vi.fn().mockResolvedValue({
          keyword: 'reactjs',
          affectedJobCount: 0,
          allTechs: [],
          aiRecommendation: null,
          humanDecision: null,
          commitResult: { ok: true, changes: [] },
        }),
        getState: vi.fn(),
      },
    };
    const service = createService({ graph });

    const result = await service.startSession('reactjs');

    expect(result.ok).toBe(false);
  });
});

describe('Service.resumeSession (mocked graph, error branches)', () => {
  it('returns { ok: false, error: "graph_error" } when graph.app.invoke throws after the thread is found', async () => {
    const graph = {
      app: {
        getState: vi.fn().mockResolvedValue({ values: { keyword: 'reactjs' }, next: ['classify'] }),
        invoke: vi.fn().mockRejectedValue(new Error('commit node exploded')),
      },
    };
    const service = createService({ graph });

    const result = await service.resumeSession('thread-1', { path: 'C' });

    expect(result).toEqual({ ok: false, error: 'graph_error', message: 'commit node exploded' });
  });

  it('returns { ok: false, error: "graph_error" } when the graph completes without producing a commitResult', async () => {
    const graph = {
      app: {
        getState: vi.fn().mockResolvedValue({ values: { keyword: 'reactjs' }, next: ['classify'] }),
        invoke: vi.fn().mockResolvedValue({
          keyword: 'reactjs',
          affectedJobCount: 0,
          allTechs: [],
          aiRecommendation: null,
          humanDecision: { path: 'C' },
          commitResult: null,
        }),
      },
    };
    const service = createService({ graph });

    const result = await service.resumeSession('thread-1', { path: 'C' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('graph_error');
    }
  });
});
