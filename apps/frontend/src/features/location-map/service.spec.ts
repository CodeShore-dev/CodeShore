import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../httpClient', () => ({
  httpClient: { get },
}));

import { fetchLocationTechStats } from './service';

const listResponse = {
  result: [
    { location: '台北市大安區', tech: 'typescript', job_count: 10 },
    { location: '新北市板橋區', tech: 'typescript', job_count: 6 },
  ],
  count: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchLocationTechStats', () => {
  it('GETs /api/job/location-tech with the given where JSON-stringified and default pagination/orders', async () => {
    get.mockResolvedValue({ data: listResponse });

    const result = await fetchLocationTechStats({
      tech: { eq: 'typescript' },
    });

    expect(get).toHaveBeenCalledWith('/api/job/location-tech', {
      params: {
        from: 0,
        to: -1,
        orders: 'job_count:desc',
        where: JSON.stringify({ tech: { eq: 'typescript' } }),
      },
    });
    expect(result).toEqual(listResponse);
  });

  it('lets the caller override from/to/orders (region detail panel Top-10 use case)', async () => {
    get.mockResolvedValue({ data: listResponse });

    await fetchLocationTechStats(
      { location: { eq: '台北市大安區' } },
      { from: 0, to: 9, orders: 'job_count:desc' },
    );

    expect(get).toHaveBeenCalledWith('/api/job/location-tech', {
      params: {
        from: 0,
        to: 9,
        orders: 'job_count:desc',
        where: JSON.stringify({ location: { eq: '台北市大安區' } }),
      },
    });
  });

  it('propagates a rejected request as-is', async () => {
    const error = new Error('network down');
    get.mockRejectedValue(error);

    await expect(
      fetchLocationTechStats({ tech: { eq: 'react' } }),
    ).rejects.toBe(error);
  });
});
