import { describe, expect, it, vi } from 'vitest';

import { KEYWORD_COUNT_THRESHOLD, Service } from './service';

/**
 * Builds a `Service` with constructor-injected fakes, following
 * `ai-suggestion/service.spec.ts`'s established `createService(overrides)`
 * convention. Every dependency defaults to an empty stub object so tests
 * that don't exercise a given data-utils service don't need to know about
 * it.
 */
function createService(
  overrides: {
    keywordService?: any;
    techKeywordService?: any;
    keywordBinService?: any;
    jobKeywordService?: any;
  } = {},
): Service {
  return new Service(
    overrides.keywordService ?? {},
    overrides.techKeywordService ?? {},
    overrides.keywordBinService ?? {},
    overrides.jobKeywordService ?? {},
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
