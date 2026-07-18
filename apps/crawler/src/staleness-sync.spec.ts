import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SupabaseTable } from '@codeshore/data-types';

// `staleness-sync.ts` imports `type { StalenessSyncConfig } from '@codeshore/sync-core'`
// (type-only import, erased at compile time) but ALSO transitively imports
// `@codeshore/data-utils` (JobService/JobKeywordService), which constructs a
// real Supabase client under the hood. We mock `@codeshore/data-utils` the
// same way `apps/crawler/src/persistence.spec.ts` and the 104/Cake
// `handler.spec.ts` files do, so importing this module never touches
// Supabase or reads real env config.
//
// Per the Task 5.2/5.3 lesson recorded in tasks.md Implementation Notes: any
// module that transitively imports `@codeshore/sync-core` (even just a type)
// risks pulling in the real barrel at runtime if the type import isn't fully
// erased in some execution path, and the barrel unconditionally re-exports
// `createStalenessSyncEngine`, which imports real `crawlee`. This is verified
// empirically below (see the timing note in the Status Report) rather than
// assumed; a `beforeAll` pre-warm with a generous timeout is used regardless
// as a defensive measure, matching the established pattern in this codebase.
const { upsertMock, fetchAllMock } = vi.hoisted(() => {
  const upsertMockInner = vi.fn(async () => undefined);
  const fetchAllMockInner = vi.fn(async () => ({
    result: [] as SupabaseTable.Job[],
    count: 0,
    searchParams: '',
  }));
  return {
    upsertMock: upsertMockInner,
    fetchAllMock: fetchAllMockInner,
  };
});

vi.mock('@codeshore/data-utils', () => ({
  JobService: vi.fn(() => ({
    upsert: upsertMock,
    fetchAll: fetchAllMock,
  })),
  JobKeywordService: vi.fn(() => ({
    upsert: upsertMock,
  })),
}));

function buildJob(overrides: Partial<SupabaseTable.Job> = {}): SupabaseTable.Job {
  return {
    id: 'job-001',
    title: '資深後端工程師',
    detail_link: 'https://www.104.com.tw/job/job-001',
    description: '原始職缺描述',
    salary: '月薪 60,000 元以上',
    salary_manual: false,
    min_salary: 60000,
    max_salary: 9999999,
    salary_type: 'month',
    location: '台北市信義區',
    company_id: 'cust-001',
    closed: false,
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    crawled_at: new Date('2026-01-01T00:00:00.000Z'),
    created_at: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  } as SupabaseTable.Job;
}

describe('staleness-sync.ts createJobStalenessSyncConfig', () => {
  // Pre-warm the module import once, with a generous timeout, following the
  // established defensive pattern from 104/handler.spec.ts and
  // cake/handler.spec.ts (Task 5.2/5.3 lesson) in case any transitive import
  // triggers a real, slow module load.
  beforeAll(async () => {
    await import('./staleness-sync');
  }, 15000);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchAllMock.mockResolvedValue({
      result: [] as SupabaseTable.Job[],
      count: 0,
      searchParams: '',
    });
  });

  describe('resolveHost', () => {
    it('resolves the 104 detail URL to its hostname', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      expect(config.resolveHost('https://www.104.com.tw/job/job-001')).toBe(
        'www.104.com.tw',
      );
    });

    it('resolves the Cake detail URL to its hostname', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      expect(config.resolveHost('https://www.cake.me/companies/x/jobs/y')).toBe(
        'www.cake.me',
      );
    });
  });

  describe('waitSelectorForHost / extractDetailForHost dispatch', () => {
    it('dispatches to 104 wait selector and extraction function for a 104 host', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const host = config.resolveHost('https://www.104.com.tw/job/job-001');

      expect(config.waitSelectorForHost(host)).toBe(
        '.job-description__content',
      );
      expect(typeof config.extractDetailForHost(host)).toBe('function');
    });

    it('dispatches to Cake wait selector and extraction function for a Cake host', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const host = config.resolveHost('https://www.cake.me/companies/x/jobs/y');

      expect(config.waitSelectorForHost(host)).toBe(
        '[class^=ContentSection-module-scss-module__][class$=__content]',
      );
      expect(typeof config.extractDetailForHost(host)).toBe('function');
    });

    it('throws for an unknown host in waitSelectorForHost, matching reCrawlJobs original throw behavior', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const host = config.resolveHost('https://unknown.example.com/job/1');

      expect(() => config.waitSelectorForHost(host)).toThrow(
        /Unknown detail link host/,
      );
    });

    it('throws for an unknown host in extractDetailForHost, matching reCrawlJobs original throw behavior', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const host = config.resolveHost('https://unknown.example.com/job/1');

      expect(() => config.extractDetailForHost(host)).toThrow(
        /Unknown detail link host/,
      );
    });
  });

  describe('resolveDetailUrl', () => {
    it('resolves to the entity detail_link', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const job = buildJob({ detail_link: 'https://www.104.com.tw/job/xyz' });
      expect(config.resolveDetailUrl(job)).toBe(
        'https://www.104.com.tw/job/xyz',
      );
    });
  });

  describe('diffAndBuildUpdate', () => {
    it('returns action "update" when description changed, refreshing description/updated_at/closed and leaving salary/location untouched', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const job = buildJob({
        description: '舊的描述',
        salary: '月薪 60,000 元以上',
        location: '台北市信義區',
      });

      const result = config.diffAndBuildUpdate(job, {
        description: '新的描述',
        salary: '月薪 60,000 元以上',
        location: '台北市信義區',
      });

      expect(result.action).toBe('update');
      expect(result.entity.description).toBe('新的描述');
      expect(result.entity.location).toBe('台北市信義區');
      expect(result.entity.closed).toBe(false);
      expect(result.entity.updated_at).toBeInstanceOf(Date);
      expect(result.entity.updated_at).not.toEqual(job.updated_at);
      expect(result.entity.crawled_at).toBeInstanceOf(Date);
      expect(result.entity.crawled_at).not.toEqual(job.crawled_at);
      // salary was not part of the diff (unchanged) so no salary re-parse
      // fields should be forcibly injected beyond what parseSalary produces
      // when salaryChanged is true; here salary is untouched entirely.
      expect(result.entity.salary).toBe('月薪 60,000 元以上');
    });

    it('returns action "update" when salary changed and salary_manual is false, applying parseSalary output', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const job = buildJob({
        description: '相同描述',
        salary: '月薪 60,000 元以上',
        salary_manual: false,
        location: '台北市信義區',
      });

      const result = config.diffAndBuildUpdate(job, {
        description: '相同描述',
        salary: '月薪 80,000 元以上',
        location: '台北市信義區',
      });

      expect(result.action).toBe('update');
      expect(result.entity.salary).toBe('月薪 80,000 元以上');
      // parseSalary('月薪 80,000 元以上') should set min_salary/max_salary
      // based on the shared-utils parsing logic (single-number => min only).
      expect(result.entity.min_salary).toBe(80000);
      expect(result.entity.closed).toBe(false);
      expect(result.entity.updated_at).not.toEqual(job.updated_at);
      expect(result.entity.crawled_at).not.toEqual(job.crawled_at);
    });

    it('does NOT treat salary as changed when salary_manual is true, even if detail.salary differs (matches reCrawlJobs !job.salary_manual guard)', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const job = buildJob({
        description: '相同描述',
        salary: '月薪 60,000 元以上',
        salary_manual: true,
        location: '台北市信義區',
      });

      const result = config.diffAndBuildUpdate(job, {
        description: '相同描述',
        salary: '月薪 999,000 元以上',
        location: '台北市信義區',
      });

      // No field changed (salary change is suppressed by salary_manual),
      // so this must fall into the "unchanged" branch, not "update".
      expect(result.action).toBe('unchanged');
      expect(result.entity.salary).toBe('月薪 60,000 元以上');
      expect(result.entity.updated_at).toEqual(job.updated_at);
      expect(result.entity.crawled_at).not.toEqual(job.crawled_at);
    });

    it('returns action "update" when location changed', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const job = buildJob({
        description: '相同描述',
        salary: '月薪 60,000 元以上',
        location: '台北市信義區',
      });

      const result = config.diffAndBuildUpdate(job, {
        description: '相同描述',
        salary: '月薪 60,000 元以上',
        location: '新北市板橋區',
      });

      expect(result.action).toBe('update');
      expect(result.entity.location).toBe('新北市板橋區');
      expect(result.entity.closed).toBe(false);
      expect(result.entity.updated_at).not.toEqual(job.updated_at);
      expect(result.entity.crawled_at).not.toEqual(job.crawled_at);
    });

    it('returns action "unchanged" and bumps crawled_at while leaving updated_at exactly as it was, without altering other fields', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const originalUpdatedAt = new Date('2026-01-01T00:00:00.000Z');
      const originalCrawledAt = new Date('2026-01-01T00:00:00.000Z');
      const job = buildJob({
        description: '相同描述',
        salary: '月薪 60,000 元以上',
        location: '台北市信義區',
        updated_at: originalUpdatedAt,
        crawled_at: originalCrawledAt,
      });

      const result = config.diffAndBuildUpdate(job, {
        description: '相同描述',
        salary: '月薪 60,000 元以上',
        location: '台北市信義區',
      });

      expect(result.action).toBe('unchanged');
      expect(result.entity.description).toBe('相同描述');
      expect(result.entity.salary).toBe('月薪 60,000 元以上');
      expect(result.entity.location).toBe('台北市信義區');
      expect(result.entity.closed).toBe(false);
      // `updated_at` must stay exactly as it was on the input entity — no
      // real content change was detected (Requirement 2.3).
      expect(result.entity.updated_at).toEqual(originalUpdatedAt);
      // `crawled_at` always advances, regardless of outcome (Requirement 2.1).
      expect(result.entity.crawled_at).toBeInstanceOf(Date);
      expect(result.entity.crawled_at).not.toEqual(originalCrawledAt);
    });

    it('returns action "close" when extracted content has no valid description (whitespace only), bumping both timestamps when the job was NOT already closed', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const originalUpdatedAt = new Date('2026-01-01T00:00:00.000Z');
      const originalCrawledAt = new Date('2026-01-01T00:00:00.000Z');
      const job = buildJob({
        closed: false,
        updated_at: originalUpdatedAt,
        crawled_at: originalCrawledAt,
      });

      const result = config.diffAndBuildUpdate(job, {
        description: '   ',
        salary: '',
        location: '',
      });

      expect(result.action).toBe('close');
      expect(result.entity.closed).toBe(true);
      expect(result.entity.updated_at).toBeInstanceOf(Date);
      expect(result.entity.updated_at).not.toEqual(originalUpdatedAt);
      expect(result.entity.crawled_at).toBeInstanceOf(Date);
      expect(result.entity.crawled_at).not.toEqual(originalCrawledAt);
    });

    it('returns action "close" and only bumps crawled_at (leaving updated_at unchanged) when the job was ALREADY closed', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const originalUpdatedAt = new Date('2026-01-01T00:00:00.000Z');
      const originalCrawledAt = new Date('2026-01-01T00:00:00.000Z');
      const job = buildJob({
        closed: true,
        updated_at: originalUpdatedAt,
        crawled_at: originalCrawledAt,
      });

      const result = config.diffAndBuildUpdate(job, {
        description: '   ',
        salary: '',
        location: '',
      });

      expect(result.action).toBe('close');
      expect(result.entity.closed).toBe(true);
      // Already closed before => not a new transition, updated_at stays put.
      expect(result.entity.updated_at).toEqual(originalUpdatedAt);
      expect(result.entity.crawled_at).toBeInstanceOf(Date);
      expect(result.entity.crawled_at).not.toEqual(originalCrawledAt);
    });

    it('returns action "close" when detail is undefined (extraction failed entirely)', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const job = buildJob({ closed: false });

      const result = config.diffAndBuildUpdate(job, undefined);

      expect(result.action).toBe('close');
      expect(result.entity.closed).toBe(true);
      expect(result.entity.updated_at).not.toEqual(job.updated_at);
      expect(result.entity.crawled_at).not.toEqual(job.crawled_at);
    });

    it('does not mutate the input entity object', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const job = buildJob({ description: '舊的描述' });
      const originalDescription = job.description;

      config.diffAndBuildUpdate(job, {
        description: '新的描述',
        salary: job.salary,
        location: job.location,
      });

      expect(job.description).toBe(originalDescription);
    });
  });

  describe('onBatchReady', () => {
    it('upserts jobs via JobService and recomputes job_keyword only for entities that came from the "update" branch', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig(['Node.js', '後端']);

      const changedJob = buildJob({
        id: 'job-changed',
        description: '舊描述',
      });
      const unchangedJob = buildJob({
        id: 'job-unchanged',
        description: '不變描述',
        salary: '月薪 60,000 元以上',
        location: '台北市信義區',
      });

      const updateResult = config.diffAndBuildUpdate(changedJob, {
        description: '新描述含 Node.js 後端',
        salary: changedJob.salary,
        location: changedJob.location,
      });
      const unchangedResult = config.diffAndBuildUpdate(unchangedJob, {
        description: unchangedJob.description,
        salary: unchangedJob.salary,
        location: unchangedJob.location,
      });

      await config.onBatchReady([updateResult.entity, unchangedResult.entity]);

      expect(upsertMock).toHaveBeenCalledWith([
        updateResult.entity,
        unchangedResult.entity,
      ]);
      // JobKeywordService.upsert should only be called with the changed job.
      const calls = upsertMock.mock.calls as unknown as unknown[][];
      const keywordUpsertCalls = calls.filter(call => {
        const arg = call[0];
        return (
          Array.isArray(arg) &&
          arg.length > 0 &&
          (arg[0] as { keywords?: unknown }).keywords !== undefined
        );
      });
      expect(keywordUpsertCalls).toHaveLength(1);
      expect(keywordUpsertCalls[0][0]).toEqual([
        expect.objectContaining({ id: 'job-changed' }),
      ]);
    });

    it('does not call JobKeywordService.upsert when no entity in the batch came from the "update" branch', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      const closedJob = buildJob({ id: 'job-closed' });
      const closeResult = config.diffAndBuildUpdate(closedJob, undefined);

      await config.onBatchReady([closeResult.entity]);

      const calls = upsertMock.mock.calls as unknown as unknown[][];
      const keywordUpsertCalls = calls.filter(call => {
        const arg = call[0];
        return (
          Array.isArray(arg) &&
          arg.length > 0 &&
          (arg[0] as { keywords?: unknown }).keywords !== undefined
        );
      });
      expect(keywordUpsertCalls).toHaveLength(0);
      expect(upsertMock).toHaveBeenCalledWith([closeResult.entity]);
    });

    it('does nothing when entities array is empty', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);

      await config.onBatchReady([]);

      expect(upsertMock).not.toHaveBeenCalled();
    });
  });

  describe('fetchStaleEntities', () => {
    it('queries JobService with the default "crawled_at before yesterday midnight" condition when no where override is given', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);

      await config.fetchStaleEntities();

      expect(fetchAllMock).toHaveBeenCalledTimes(1);
      const calls = fetchAllMock.mock.calls as unknown as unknown[][];
      const callArg = calls[0][0] as {
        where: { crawled_at: { lt: string } };
        orders: { column: string; ascending: boolean }[];
      };
      expect(callArg.orders).toEqual([
        { column: 'min_salary', ascending: false },
      ]);
      // Matches reCrawlJobs's original cutoff calculation exactly (main.ts
      // L100-105): `dayjs().subtract(1, 'day').toDate()` with
      // `setHours(0, 0, 0, 0)` applied in LOCAL time, then serialized via
      // `.toISOString()` (UTC). Depending on the runner's timezone offset,
      // the resulting ISO string's time-of-day component is not necessarily
      // "00:00:00.000Z" — it's local midnight expressed in UTC. Assert this
      // ISO string equals what the identical calculation produces directly,
      // rather than assuming a fixed UTC offset.
      // Per Requirement 4.1, admin re-crawl selection tracks crawl activity
      // (`crawled_at`), not content-change activity (`updated_at`).
      const expectedYesterday = new Date();
      expectedYesterday.setDate(expectedYesterday.getDate() - 1);
      expectedYesterday.setHours(0, 0, 0, 0);
      expect(callArg.where.crawled_at.lt).toBe(
        expectedYesterday.toISOString(),
      );
    });

    it('uses the caller-provided where override instead of the default cutoff when given', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const customWhere = { id: { in: '(job-1,job-2)' } };
      const config = createJobStalenessSyncConfig([], customWhere);

      await config.fetchStaleEntities();

      expect(fetchAllMock).toHaveBeenCalledWith({
        where: customWhere,
        orders: [{ column: 'min_salary', ascending: false }],
      });
    });

    it('returns the jobs from the query result', async () => {
      const job = buildJob();
      fetchAllMock.mockResolvedValueOnce({
        result: [job],
        count: 1,
        searchParams: '',
      });
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);

      const result = await config.fetchStaleEntities();

      expect(result).toEqual([job]);
    });
  });

  describe('batchSize', () => {
    it('defaults to 20, matching reCrawlJobs original BATCH_SIZE constant', async () => {
      const { createJobStalenessSyncConfig } = await import('./staleness-sync');
      const config = createJobStalenessSyncConfig([]);
      expect(config.batchSize).toBe(20);
    });
  });
});
