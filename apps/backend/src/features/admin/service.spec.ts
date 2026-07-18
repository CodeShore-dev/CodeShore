import { Service } from './service';

describe('Service.getSalaryAnomalies', () => {
  it('requests crawled_at (not just updated_at) via the default SALARY_SELECT so the anomaly list can display crawl time', async () => {
    const jobService = {
      fetch: vi.fn().mockResolvedValue({ result: [], count: 0 }),
    };
    const service = new Service(jobService as any);

    await service.getSalaryAnomalies(
      { from: 0, to: 10 } as any,
      1000000,
      12000000,
    );

    expect(jobService.fetch).toHaveBeenCalledTimes(1);
    const call = jobService.fetch.mock.calls[0][0];
    expect(call.select).toContain('crawled_at');
  });
});

describe('Service.getEmptyDescriptionJobs', () => {
  it('requests crawled_at (not just updated_at) via the default DESCRIPTION_SELECT so the anomaly list can display crawl time', async () => {
    const jobService = {
      fetch: vi.fn().mockResolvedValue({ result: [], count: 0 }),
    };
    const service = new Service(jobService as any);

    await service.getEmptyDescriptionJobs({
      from: 0,
      to: 10,
    } as any);

    expect(jobService.fetch).toHaveBeenCalledTimes(1);
    const call = jobService.fetch.mock.calls[0][0];
    expect(call.select).toContain('crawled_at');
  });
});

describe('Service (private buildCrawlArgs) — recrawl-cond condition validation', () => {
  it('accepts a crawled_at.lt.<date> condition (the frontend default re-crawl condition since task 4.1) instead of rejecting it as an unsupported column', async () => {
    const service = new Service(undefined as any);

    const args = await (service as any).buildCrawlArgs({
      mode: 'recrawl-cond',
      where: 'crawled_at.lt.2026-01-01',
    });

    expect(args).toEqual(['re-crawl=crawled_at.lt.2026-01-01']);
  });

  it('still rejects a genuinely unsupported column', async () => {
    const service = new Service(undefined as any);

    await expect(
      (service as any).buildCrawlArgs({
        mode: 'recrawl-cond',
        where: 'not_a_real_column.eq.1',
      }),
    ).rejects.toThrow(/Unsupported filter column/);
  });
});

describe('Service (private buildCrawlArgs) — recrawl-dates where-expression', () => {
  it('builds a where-expression filtering by crawled_at, matching the crawl-date buckets shown in the daily stats table (getJobUpdateDateCounts groups by crawled_at)', async () => {
    const service = new Service(undefined as any);

    const args = await (service as any).buildCrawlArgs({
      mode: 'recrawl-dates',
      dates: ['2026-01-01'],
    });

    expect(args).toEqual([
      're-crawl=(and(crawled_at.gte.2026-01-01,crawled_at.lt.2026-01-02))',
    ]);
  });
});
