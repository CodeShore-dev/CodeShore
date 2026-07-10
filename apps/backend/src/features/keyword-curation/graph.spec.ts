import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import type { CurationState, TechOption } from './graph.types';
import { FetchContextNode } from './graph';

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
