import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListQuery } from '../../../@types';
import { useKeywordTechRanking } from './useKeywordTechRanking';

const { fetchMvTechRanking } = vi.hoisted(() => ({
  fetchMvTechRanking: vi.fn(),
}));

vi.mock('../service', () => ({ fetchMvTechRanking }));

// Mirrors the production defaults in lib/queryClient.ts (60s stale window),
// so remount behaviour matches the real app.
function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000, gcTime: 5 * 60_000 },
    },
  });
}

function wrapperFor(client: QueryClient, strict = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const tree = <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
}

function whereOf(query: ListQuery): Record<string, unknown> {
  return JSON.parse(String(query.where));
}

describe('useKeywordTechRanking', () => {
  beforeEach(() => {
    fetchMvTechRanking.mockReset();
    fetchMvTechRanking.mockResolvedValue({
      result: [{ tech: 'react', label: 'React' }],
    });
  });

  it('defaults to the language category and fetches top 10 with job_count >= 8', async () => {
    const { result } = renderHook(() => useKeywordTechRanking(), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selectedCategory).toBe('language');
    expect(result.current.items).toEqual([{ tech: 'react', label: 'React' }]);
    expect(fetchMvTechRanking).toHaveBeenCalledTimes(1);
    const [query] = fetchMvTechRanking.mock.calls[0] as [ListQuery];
    expect(query.from).toBe(0);
    expect(query.to).toBe(9);
    expect(query.orders).toBe('job_count:desc');
    expect(whereOf(query)).toEqual({
      category: { eq: 'language' },
      job_count: { gte: 8 },
    });
  });

  it('switching category fetches that category under its own key', async () => {
    const { result } = renderHook(() => useKeywordTechRanking(), {
      wrapper: wrapperFor(createClient()),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedCategory('framework'));

    await waitFor(() => expect(result.current.selectedCategory).toBe('framework'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMvTechRanking).toHaveBeenCalledTimes(2);
    const [second] = fetchMvTechRanking.mock.calls[1] as [ListQuery];
    expect(whereOf(second).category).toEqual({ eq: 'framework' });
  });

  it('remounting inside the stale window does not refetch', async () => {
    const client = createClient();
    const first = renderHook(() => useKeywordTechRanking(), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    const second = renderHook(() => useKeywordTechRanking(), {
      wrapper: wrapperFor(client),
    });

    expect(second.result.current.items).toEqual([{ tech: 'react', label: 'React' }]);
    expect(fetchMvTechRanking).toHaveBeenCalledTimes(1);
  });

  it('StrictMode mount sends one request, not two', async () => {
    const { result } = renderHook(() => useKeywordTechRanking(), {
      wrapper: wrapperFor(createClient(), true),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMvTechRanking).toHaveBeenCalledTimes(1);
  });

  it('enabled=false sends nothing, and enabling later sends exactly one request', async () => {
    const client = createClient();
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useKeywordTechRanking({ enabled }), {
      initialProps: { enabled: false },
      wrapper: wrapperFor(client),
    });

    expect(fetchMvTechRanking).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMvTechRanking).toHaveBeenCalledTimes(1);
  });

  it('instances with different where or orders do not share cache entries', async () => {
    const client = createClient();
    fetchMvTechRanking.mockImplementation(async (query: ListQuery) => ({
      result: [{ tech: String(query.orders), label: 'x' }],
    }));

    const popular = renderHook(() => useKeywordTechRanking(), {
      wrapper: wrapperFor(client),
    });
    const salary = renderHook(
      () =>
        useKeywordTechRanking({
          where: { $or: { year_median_avg: { gte: 1200000 } } },
          orders: 'year_median_avg:desc',
        }),
      { wrapper: wrapperFor(client) },
    );

    await waitFor(() => expect(popular.result.current.loading).toBe(false));
    await waitFor(() => expect(salary.result.current.loading).toBe(false));

    expect(fetchMvTechRanking).toHaveBeenCalledTimes(2);
    expect(popular.result.current.items[0].tech).toBe('job_count:desc');
    expect(salary.result.current.items[0].tech).toBe('year_median_avg:desc');
  });
});
