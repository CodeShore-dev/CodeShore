import { BadRequestException, ConflictException } from '@nestjs/common';

import { getJobPreferenceReasonCounts } from '@codeshore/data-utils';

import { Service } from './service';

vi.mock('@codeshore/data-utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@codeshore/data-utils')>()),
  getJobPreferenceReasonCounts: vi.fn(),
}));

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

/**
 * Task 2.3 (design.md "Backend：Job Controller / Service", GET
 * `/job/preference/:preference/reasons`): returns the in-use reasons with
 * their job counts for one preference (1.4, 3.1, 3.2). No backend cache
 * (D7). An unknown preference is a 400.
 */
describe('Service.getPreferenceReasons (task 2.3)', () => {
  const makeService = () => {
    const cacheService = {
      getOrSet: vi.fn(),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };
    const service = new Service(
      cacheService as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
    );
    return { service, cacheService };
  };

  it.each(['like', 'dislike'] as const)(
    'passes userId and preference=%s through and returns the rows as-is, without caching',
    async preference => {
      const rows = [
        { reason: '想投', job_count: 3 },
        { reason: '未分類', job_count: 1 },
      ];
      vi.mocked(getJobPreferenceReasonCounts).mockReset();
      vi.mocked(getJobPreferenceReasonCounts).mockResolvedValue(rows);
      const { service, cacheService } = makeService();

      const result = await service.getPreferenceReasons(preference, 'user-1');

      expect(getJobPreferenceReasonCounts).toHaveBeenCalledWith(
        'user-1',
        preference,
      );
      expect(result).toBe(rows);
      expect(cacheService.getOrSet).not.toHaveBeenCalled();
    },
  );

  it.each(['favorite', '', 'LIKE'])(
    'rejects preference=%j with a 400 and does not query',
    async preference => {
      vi.mocked(getJobPreferenceReasonCounts).mockReset();
      const { service } = makeService();

      const promise = service.getPreferenceReasons(preference, 'user-1');

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      expect(getJobPreferenceReasonCounts).not.toHaveBeenCalled();
    },
  );
});

/**
 * Task 2.3 (design.md "Backend：Job Controller / Service", DELETE
 * `/job/preference/:preference/reasons/:reason`): the default reason cannot
 * be deleted (5.6); any other name is batch-reset to the default via
 * `resetReason` (5.3, 5.4) and the preference-count cache is invalidated.
 */
describe('Service.deletePreferenceReason (task 2.3)', () => {
  const makeService = () => {
    const cacheService = { invalidate: vi.fn().mockResolvedValue(undefined) };
    const jobPreferenceService = {
      resetReason: vi.fn().mockResolvedValue({ updated: 4 }),
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

  it('resets the normalized name for this user/preference, invalidates the count cache and returns { updated }', async () => {
    const { service, cacheService, jobPreferenceService } = makeService();

    const result = await service.deletePreferenceReason(
      'dislike',
      '  技能已符合 ',
      'user-1',
    );

    expect(jobPreferenceService.resetReason).toHaveBeenCalledWith(
      'user-1',
      'dislike',
      '技能已符合',
    );
    expect(cacheService.invalidate).toHaveBeenCalledWith(
      'job-preference-count:user-1',
    );
    expect(result).toEqual({ updated: 4 });
  });

  it.each([
    ['the default reason', '未分類'],
    ['the default reason with surrounding spaces', '  未分類 '],
    ['an empty string', ''],
    ['a whitespace-only string', '   '],
    ['a 21-character name', '字'.repeat(21)],
  ])('rejects %s with a 400 and does not reset', async (_label, reason) => {
    const { service, cacheService, jobPreferenceService } = makeService();

    const promise = service.deletePreferenceReason('like', reason, 'user-1');

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(jobPreferenceService.resetReason).not.toHaveBeenCalled();
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });

  it('rejects an invalid preference with a 400 and does not reset', async () => {
    const { service, jobPreferenceService } = makeService();

    const promise = service.deletePreferenceReason('love', '想投', 'user-1');

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    expect(jobPreferenceService.resetReason).not.toHaveBeenCalled();
  });
});

/**
 * Task 7.2 (design.md 追加範圍 → API Contract, D9, D10): PATCH
 * `/job/preference/:preference/reasons/:reason` renames a reason in bulk.
 * Both names are normalized (9.4); the default reason cannot be renamed;
 * the same name after trimming is a no-op (9.6); an existing name, including
 * the default reason, is a 409 (9.5); otherwise `renameReason` runs (9.3) and
 * the preference-count cache is invalidated.
 */
describe('Service.renamePreferenceReason (task 7.2)', () => {
  const makeService = (exists = false) => {
    const cacheService = { invalidate: vi.fn().mockResolvedValue(undefined) };
    const jobPreferenceService = {
      renameReason: vi.fn().mockResolvedValue({ updated: 3 }),
      reasonExists: vi.fn().mockResolvedValue(exists),
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

  it('renames the normalized names for this user/preference, invalidates the count cache and returns { updated }', async () => {
    const { service, cacheService, jobPreferenceService } = makeService();

    const result = await service.renamePreferenceReason(
      'dislike',
      '  技能已符合 ',
      ' 薪資太低  ',
      'user-1',
    );

    expect(jobPreferenceService.reasonExists).toHaveBeenCalledWith(
      'user-1',
      'dislike',
      '薪資太低',
    );
    expect(jobPreferenceService.renameReason).toHaveBeenCalledWith(
      'user-1',
      'dislike',
      '技能已符合',
      '薪資太低',
    );
    expect(cacheService.invalidate).toHaveBeenCalledWith(
      'job-preference-count:user-1',
    );
    expect(result).toEqual({ updated: 3 });
  });

  it('returns { updated: 0 } without writing when the new name equals the old one after trimming', async () => {
    const { service, cacheService, jobPreferenceService } = makeService();

    const result = await service.renamePreferenceReason(
      'like',
      '想投',
      '  想投 ',
      'user-1',
    );

    expect(result).toEqual({ updated: 0 });
    expect(jobPreferenceService.reasonExists).not.toHaveBeenCalled();
    expect(jobPreferenceService.renameReason).not.toHaveBeenCalled();
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });

  it('rejects an existing name with a 409 and does not rename', async () => {
    const { service, cacheService, jobPreferenceService } = makeService(true);

    const promise = service.renamePreferenceReason(
      'like',
      '想投',
      '備用',
      'user-1',
    );

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    await expect(promise).rejects.toMatchObject({ status: 409 });
    expect(jobPreferenceService.reasonExists).toHaveBeenCalledWith(
      'user-1',
      'like',
      '備用',
    );
    expect(jobPreferenceService.renameReason).not.toHaveBeenCalled();
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });

  it.each(['未分類', '  未分類 '])(
    'rejects renaming to the default reason (%j) with a 409 without querying or renaming',
    async name => {
      const { service, cacheService, jobPreferenceService } = makeService();

      const promise = service.renamePreferenceReason(
        'like',
        '想投',
        name,
        'user-1',
      );

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toMatchObject({ status: 409 });
      expect(jobPreferenceService.reasonExists).not.toHaveBeenCalled();
      expect(jobPreferenceService.renameReason).not.toHaveBeenCalled();
      expect(cacheService.invalidate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['the default reason as the old name', '未分類', '新名稱'],
    ['the default reason with spaces as the old name', '  未分類 ', '新名稱'],
    ['an empty old name', '', '新名稱'],
    ['a 21-character old name', '字'.repeat(21), '新名稱'],
    ['an empty new name', '想投', ''],
    ['a whitespace-only new name', '想投', '   '],
    ['a 21-character new name', '想投', '字'.repeat(21)],
  ])('rejects %s with a 400 and does not rename', async (_label, reason, name) => {
    const { service, cacheService, jobPreferenceService } = makeService();

    const promise = service.renamePreferenceReason(
      'like',
      reason,
      name,
      'user-1',
    );

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(jobPreferenceService.reasonExists).not.toHaveBeenCalled();
    expect(jobPreferenceService.renameReason).not.toHaveBeenCalled();
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });

  it('rejects an invalid preference with a 400 and does not rename', async () => {
    const { service, jobPreferenceService } = makeService();

    const promise = service.renamePreferenceReason(
      'love',
      '想投',
      '備用',
      'user-1',
    );

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    expect(jobPreferenceService.reasonExists).not.toHaveBeenCalled();
    expect(jobPreferenceService.renameReason).not.toHaveBeenCalled();
  });
});
