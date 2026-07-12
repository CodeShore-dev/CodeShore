import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWatchlist } = vi.hoisted(() => ({
  fetchWatchlist: vi.fn(),
}));

vi.mock('./service', () => ({
  fetchWatchlist,
}));

import { useWatchlistQuery } from './queries';

const subscription = {
  id: 'sub-1',
  label: '技術:React',
  lastViewedAt: '2026-07-12T00:00:00.000Z',
  createdAt: '2026-07-12T00:00:00.000Z',
  totalCount: 10,
  newCount: 2,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useWatchlistQuery', () => {
  it('fetches the followed filter combinations with their counts', async () => {
    fetchWatchlist.mockResolvedValue([subscription]);

    const { result } = renderHook(() => useWatchlistQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchWatchlist).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([subscription]);
  });

  it('exposes a loading state before the fetch resolves', () => {
    fetchWatchlist.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useWatchlistQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('queries under a ["job-filter-watchlist", "list"] queryKey', async () => {
    fetchWatchlist.mockResolvedValue([subscription]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useWatchlistQuery(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      client.getQueryData(['job-filter-watchlist', 'list']),
    ).toEqual([subscription]);
  });
});
