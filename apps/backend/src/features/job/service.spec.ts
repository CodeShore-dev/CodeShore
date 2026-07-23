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
