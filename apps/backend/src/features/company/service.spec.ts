import { Service } from './service';

describe('Service.getCompanyTechStats', () => {
  it("calls MvCompanyTechService.fetchAll with the company's id filter and job_count descending order, and returns its result", async () => {
    const expected = {
      result: [
        { company_id: 'company-1', tech: 'typescript', job_count: 10 },
        { company_id: 'company-1', tech: 'go', job_count: 6 },
        { company_id: 'company-1', tech: 'python', job_count: 3 },
      ],
      count: 3,
    };
    const mvCompanyTechService = {
      fetchAll: vi.fn().mockResolvedValue(expected),
    };
    const service = new Service(
      undefined as any,
      mvCompanyTechService as any,
    );

    const result = await service.getCompanyTechStats('company-1');

    expect(mvCompanyTechService.fetchAll).toHaveBeenCalledWith({
      where: { company_id: { eq: 'company-1' } },
      orders: [{ column: 'job_count', ascending: false }],
    });
    expect(result).toBe(expected);
  });

  it('returns an empty list rather than an error for a company with no matching rows', async () => {
    const expected = { result: [], count: 0 };
    const mvCompanyTechService = {
      fetchAll: vi.fn().mockResolvedValue(expected),
    };
    const service = new Service(
      undefined as any,
      mvCompanyTechService as any,
    );

    const result = await service.getCompanyTechStats(
      'company-does-not-exist',
    );

    expect(mvCompanyTechService.fetchAll).toHaveBeenCalledWith({
      where: { company_id: { eq: 'company-does-not-exist' } },
      orders: [{ column: 'job_count', ascending: false }],
    });
    expect(result.result).toEqual([]);
    expect(result.count).toBe(0);
  });
});
