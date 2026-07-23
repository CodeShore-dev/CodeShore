import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchLocationTechStats } = vi.hoisted(() => ({
  fetchLocationTechStats: vi.fn(),
}));

vi.mock('./service', () => ({
  fetchLocationTechStats,
}));

import { useLocationTechStatsQuery } from './queries';

const rows = [
  { location: '台北市大安區', tech: 'typescript', job_count: 10 },
  { location: '新北市板橋區', tech: 'typescript', job_count: 6 },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useLocationTechStatsQuery', () => {
  it('fetches the tech stats for the given where filter and returns the result rows', async () => {
    fetchLocationTechStats.mockResolvedValue({ result: rows, count: 2 });

    const { result } = renderHook(
      () => useLocationTechStatsQuery({ tech: { eq: 'typescript' } }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchLocationTechStats).toHaveBeenCalledWith(
      { tech: { eq: 'typescript' } },
      { from: 0, to: -1, orders: 'job_count:desc' },
    );
    expect(result.current.data).toEqual(rows);
  });

  it('exposes a loading state before the fetch resolves', () => {
    fetchLocationTechStats.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useLocationTechStatsQuery({ tech: { eq: 'typescript' } }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('exposes an error state when the fetch rejects', async () => {
    fetchLocationTechStats.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(
      () => useLocationTechStatsQuery({ tech: { eq: 'typescript' } }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });

  it('passes through from/to/orders overrides (region detail panel Top-10 use case)', async () => {
    fetchLocationTechStats.mockResolvedValue({ result: rows, count: 2 });

    const { result } = renderHook(
      () =>
        useLocationTechStatsQuery(
          { location: { eq: '台北市大安區' } },
          { from: 0, to: 9 },
        ),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchLocationTechStats).toHaveBeenCalledWith(
      { location: { eq: '台北市大安區' } },
      { from: 0, to: 9, orders: 'job_count:desc' },
    );
  });

  it('caches distinct `where` filters independently under the queryKey', async () => {
    fetchLocationTechStats.mockResolvedValue({ result: rows, count: 2 });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const clientWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const first = renderHook(
      () => useLocationTechStatsQuery({ tech: { eq: 'typescript' } }),
      { wrapper: clientWrapper },
    );
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    const second = renderHook(
      () =>
        useLocationTechStatsQuery({ location: { eq: '台北市大安區' } }),
      { wrapper: clientWrapper },
    );
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    // Two distinct `where` filters -> two fetches, two independent cache
    // entries (not a single collided entry).
    expect(fetchLocationTechStats).toHaveBeenCalledTimes(2);
    expect(
      client.getQueryData([
        'job',
        'locationTech',
        {
          where: { tech: { eq: 'typescript' } },
          from: 0,
          to: -1,
          orders: 'job_count:desc',
        },
      ]),
    ).toEqual(rows);
    expect(
      client.getQueryData([
        'job',
        'locationTech',
        {
          where: { location: { eq: '台北市大安區' } },
          from: 0,
          to: -1,
          orders: 'job_count:desc',
        },
      ]),
    ).toEqual(rows);
  });
});
