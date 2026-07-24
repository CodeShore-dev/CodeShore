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
