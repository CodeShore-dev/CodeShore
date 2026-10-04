import { describe, expect, it, vi } from 'vitest';

import { getWorkflowInfo } from '../features/ai-suggestion/workflow-info';
import { getKeywordCurationWorkflowInfo } from '../features/keyword-curation/workflow-info';
import { QueryDto } from '../features/query.dto';
import { AppService } from './app.service';

/**
 * Task 2 (methodology-ai-transparency): this is the first spec file for
 * `AppService` in this repo, and it is scoped ONLY to the newly-added
 * `getAiWorkflows()` method -- it does not retroactively test any
 * pre-existing `AppService` method.
 *
 * Proves the "single source of truth, cannot drift" contract (requirements
 * 2.3, 3.3): this test imports the exact same real, pure functions
 * `getAiWorkflows()` itself composes -- `getWorkflowInfo()` from
 * `ai-suggestion/workflow-info.ts` and `getKeywordCurationWorkflowInfo()`
 * from `keyword-curation/workflow-info.ts` -- and asserts deep equality
 * against their real output, rather than a hand-copied literal. If
 * `AppService.getAiWorkflows()` ever reimplements or paraphrases either
 * source instead of delegating to it, these assertions catch the drift.
 *
 * `AppService`'s constructor deps (`CacheService`,
 * `MvSalaryTypeMedianRatioService`, etc.) are irrelevant to this pure,
 * synchronous method -- it never touches `this` -- so they are stubbed with
 * `{} as any` rather than fully mocked.
 */
describe('AppService.getAiWorkflows', () => {
  function createService(): AppService {
    return new AppService({} as any, {} as any, {} as any, {} as any, {} as any);
  }

  it('aiSuggestion equals the real getWorkflowInfo() output (requirements 2.1-2.3)', () => {
    const service = createService();

    const result = service.getAiWorkflows();

    expect(result.aiSuggestion).toEqual(getWorkflowInfo());
  });

  it('keywordCuration equals the real getKeywordCurationWorkflowInfo() output (requirements 3.1, 3.3)', () => {
    const service = createService();

    const result = service.getAiWorkflows();

    expect(result.keywordCuration).toEqual(getKeywordCurationWorkflowInfo());
  });

  it('returns both fields together in a single AiWorkflowsResponse', () => {
    const service = createService();

    const result = service.getAiWorkflows();

    expect(result).toEqual({
      aiSuggestion: getWorkflowInfo(),
      keywordCuration: getKeywordCurationWorkflowInfo(),
    });
  });
});

/**
 * `getMvTechRanking` 的首頁快取：`to=9`（熱門技術）與 `to=4`（技術組合來源）
 * 都要進快取；快取 key 必須含 from / to / orders，否則同一個 where、不同 to
 * 的請求會拿到彼此的結果。
 */
describe('AppService.getMvTechRanking cache', () => {
  const where = { category: { eq: 'language' }, job_count: { gte: 8 } };

  function createService() {
    const cacheService = {
      getOrSet: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    };
    const mvTechRankingService = {
      fetchAll: vi.fn().mockResolvedValue([]),
    };
    const service = new AppService(
      cacheService as never,
      {} as never,
      {} as never,
      mvTechRankingService as never,
      {} as never,
    );
    return { service, cacheService, mvTechRankingService };
  }

  function queryOf(overrides: Partial<QueryDto>): QueryDto {
    return {
      from: 0,
      to: 9,
      orders: [{ column: 'job_count', ascending: false }],
      where,
      ...overrides,
    } as QueryDto;
  }

  it('to=4（技術組合來源）走快取', async () => {
    const { service, cacheService } = createService();

    await service.getMvTechRanking(queryOf({ to: 4 }));

    expect(cacheService.getOrSet).toHaveBeenCalledTimes(1);
  });

  it('to=9（熱門技術）仍走快取', async () => {
    const { service, cacheService } = createService();

    await service.getMvTechRanking(queryOf({ to: 9 }));

    expect(cacheService.getOrSet).toHaveBeenCalledTimes(1);
  });

  it('非首頁請求（如 to=19）不走快取', async () => {
    const { service, cacheService, mvTechRankingService } = createService();

    await service.getMvTechRanking(queryOf({ to: 19 }));

    expect(cacheService.getOrSet).not.toHaveBeenCalled();
    expect(mvTechRankingService.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('相同 where、只差 to 時，快取 key 不同', async () => {
    const { service, cacheService } = createService();

    await service.getMvTechRanking(queryOf({ to: 9 }));
    await service.getMvTechRanking(queryOf({ to: 4 }));

    const keys = cacheService.getOrSet.mock.calls.map(([key]) => key);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });

  it('相同 where、只差 orders 時，快取 key 不同', async () => {
    const { service, cacheService } = createService();

    await service.getMvTechRanking(queryOf({ to: 9 }));
    await service.getMvTechRanking(
      queryOf({
        to: 9,
        orders: [{ column: 'median_avg', ascending: false }],
      }),
    );

    const keys = cacheService.getOrSet.mock.calls.map(([key]) => key);
    expect(new Set(keys).size).toBe(2);
  });
});
