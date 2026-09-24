import { BadRequestException } from '@nestjs/common';

import { Service } from './service';

describe('Service.getLocationTechStats', () => {
  it('calls MvLocationTechService.fetchAll with the given query as-is (tech-scoped where) and returns its result', async () => {
    const expected = {
      result: [
        { location: '台北市大安區', tech: 'typescript', job_count: 10 },
        { location: '新北市板橋區', tech: 'typescript', job_count: 6 },
      ],
      count: 2,
    };
    const mvLocationTechService = {
      fetchAll: vi.fn().mockResolvedValue(expected),
    };
    const service = new Service(
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      mvLocationTechService as any,
    );

    const query = {
      where: { tech: { eq: 'typescript' } },
      orders: [{ column: 'job_count', ascending: false }],
      from: 0,
      to: -1,
    };
    const result = await service.getLocationTechStats(query as any);

    expect(mvLocationTechService.fetchAll).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('calls MvLocationTechService.fetchAll with the given query as-is (location-scoped where) without hardcoding either dimension', async () => {
    const expected = { result: [], count: 0 };
    const mvLocationTechService = {
      fetchAll: vi.fn().mockResolvedValue(expected),
    };
    const service = new Service(
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      mvLocationTechService as any,
    );

    const query = {
      where: { location: { eq: '台北市大安區' } },
      orders: [{ column: 'job_count', ascending: false }],
      from: 0,
      to: 9,
    };
    const result = await service.getLocationTechStats(query as any);

    expect(mvLocationTechService.fetchAll).toHaveBeenCalledWith(query);
    expect(result.result).toEqual([]);
    expect(result.count).toBe(0);
  });
});

describe('Service.getLocationSalaryStats', () => {
  it('calls MvLocationSalaryService.fetchAll with the given query as-is and returns its result', async () => {
    const expected = {
      result: [
        {
          location: '台北市信義區',
          salary_type: 'monthly',
          job_count: 8,
          avg_salary: 55000,
        },
        {
          location: '台北市信義區',
          salary_type: 'yearly',
          job_count: 3,
          avg_salary: 900000,
        },
      ],
      count: 2,
    };
    const mvLocationSalaryService = {
      fetchAll: vi.fn().mockResolvedValue(expected),
    };
    const service = new Service(
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      mvLocationSalaryService as any,
    );

    const query = {
      where: { location: { eq: '台北市信義區' } },
    };
    const result = await service.getLocationSalaryStats(query as any);

    expect(mvLocationSalaryService.fetchAll).toHaveBeenCalledWith(query);
    expect(result).toBe(expected);
  });

  it('calls MvLocationSalaryService.fetchAll with the given query as-is (empty result)', async () => {
    const expected = { result: [], count: 0 };
    const mvLocationSalaryService = {
      fetchAll: vi.fn().mockResolvedValue(expected),
    };
    const service = new Service(
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      mvLocationSalaryService as any,
    );

    const query = {
      where: { location: { eq: '不存在的地區' } },
      orders: [{ column: 'job_count', ascending: false }],
      from: 0,
      to: 9,
    };
    const result = await service.getLocationSalaryStats(query as any);

    expect(mvLocationSalaryService.fetchAll).toHaveBeenCalledWith(query);
    expect(result.result).toEqual([]);
    expect(result.count).toBe(0);
  });
});

/**
 * Task 2.2 (design.md "Backend：Job Controller / Service"): the service
 * always sends an explicit `reason` on upsert -- the normalized value when
 * given, otherwise DEFAULT_PREFERENCE_REASON -- because upsert does not apply
 * the column default to an existing row (re-marking must not keep a stale
 * reason; 1.2, 2.6). Invalid names are rejected with a 400 before writing
 * (4.2-4.4).
 */
describe('Service.setJobPreference (task 2.2)', () => {
  const makeService = () => {
    const cacheService = { invalidate: vi.fn().mockResolvedValue(undefined) };
    const jobPreferenceService = {
      upsert: vi.fn().mockResolvedValue({ result: [], count: 1 }),
    };
    const service = new Service(
      cacheService as any,
      jobPreferenceService as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
    );
    return { service, cacheService, jobPreferenceService };
  };

  it('writes the default reason 未分類 when no reason is given', async () => {
    const { service, cacheService, jobPreferenceService } = makeService();

    const result = await service.setJobPreference('job-1', 'like', 'user-1');

    expect(jobPreferenceService.upsert).toHaveBeenCalledWith([
      { job_id: 'job-1', preference: 'like', user_id: 'user-1', reason: '未分類' },
    ]);
    expect(cacheService.invalidate).toHaveBeenCalledWith(
      'job-preference-count:user-1',
    );
    expect(result).toEqual({ result: [], count: 1 });
  });

  it('writes the trimmed reason when a valid reason is given', async () => {
    const { service, jobPreferenceService } = makeService();

    await service.setJobPreference('job-1', 'dislike', 'user-1', '  技能已符合 ');

    expect(jobPreferenceService.upsert).toHaveBeenCalledWith([
      {
        job_id: 'job-1',
        preference: 'dislike',
        user_id: 'user-1',
        reason: '技能已符合',
      },
    ]);
  });

  it('replaces the whole record with the new preference and reason (upsert payload carries both)', async () => {
    const { service, jobPreferenceService } = makeService();

    await service.setJobPreference('job-1', 'like', 'user-1', '想投');
    await service.setJobPreference('job-1', 'dislike', 'user-1');

    expect(jobPreferenceService.upsert).toHaveBeenLastCalledWith([
      { job_id: 'job-1', preference: 'dislike', user_id: 'user-1', reason: '未分類' },
    ]);
  });

  it.each([
    ['an empty string', ''],
    ['a whitespace-only string', '   '],
    ['a 21-character name', '字'.repeat(21)],
  ])('rejects %s with a 400 and does not write', async (_label, reason) => {
    const { service, cacheService, jobPreferenceService } = makeService();

    const promise = service.setJobPreference('job-1', 'like', 'user-1', reason);

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(jobPreferenceService.upsert).not.toHaveBeenCalled();
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });

  it('accepts exactly 20 characters', async () => {
    const { service, jobPreferenceService } = makeService();
    const name = '字'.repeat(20);

    await service.setJobPreference('job-1', 'like', 'user-1', name);

    expect(jobPreferenceService.upsert).toHaveBeenCalledWith([
      { job_id: 'job-1', preference: 'like', user_id: 'user-1', reason: name },
    ]);
  });
});
