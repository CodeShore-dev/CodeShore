import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { followFilter, unfollowFilter, markWatchlistViewed } = vi.hoisted(
  () => ({
    followFilter: vi.fn(),
    unfollowFilter: vi.fn(),
    markWatchlistViewed: vi.fn(),
  }),
);

vi.mock('./service', () => ({
  followFilter,
  unfollowFilter,
  markWatchlistViewed,
}));

import {
  useFollowFilterMutation,
  useMarkViewedMutation,
  useUnfollowMutation,
} from './mutations';

const snapshot = {
  searchText: '',
  companyFilters: [],
  salaryFilter: 'none' as const,
  salaryAmount: { type: '' as const, amount: null },
  selectedLocations: [],
  selectedTags: ['reactjs'],
  excludedTags: [],
  techOperator: 'and' as const,
};

const subscription = {
  id: 'sub-1',
  label: '技術:React',
  lastViewedAt: '2026-07-12T00:00:00.000Z',
  createdAt: '2026-07-12T00:00:00.000Z',
  totalCount: 10,
  newCount: 2,
};

describe('watchlist mutations', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  describe('useFollowFilterMutation', () => {
    it('calls followFilter with the given filterSnapshot/filterWhere/label', async () => {
      followFilter.mockResolvedValue(subscription);

      const { result } = renderHook(() => useFollowFilterMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          filterSnapshot: snapshot,
          filterWhere: { tags: { cs: ['reactjs'] } },
          label: '技術:React',
        });
      });

      expect(followFilter).toHaveBeenCalledWith(
        snapshot,
        { tags: { cs: ['reactjs'] } },
        '技術:React',
      );
    });

    it('on success invalidates the ["job-filter-watchlist", "list"] query', async () => {
      followFilter.mockResolvedValue(subscription);
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useFollowFilterMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          filterSnapshot: snapshot,
          filterWhere: {},
          label: '技術:React',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['job-filter-watchlist', 'list'],
      });
    });

    it('a stale followed-list query actually refetches after a successful follow', async () => {
      followFilter.mockResolvedValue(subscription);
      const queryFn = vi.fn().mockResolvedValue([]);

      const { result: listResult } = renderHook(
        () =>
          useQuery({ queryKey: ['job-filter-watchlist', 'list'], queryFn }),
        { wrapper },
      );
      await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
      expect(queryFn).toHaveBeenCalledTimes(1);

      const { result } = renderHook(() => useFollowFilterMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          filterSnapshot: snapshot,
          filterWhere: {},
          label: '技術:React',
        });
      });

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });

    it('does not invalidate the followed-list query when the request fails (e.g. 409 limit reached)', async () => {
      followFilter.mockRejectedValue(new Error('limit reached'));
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useFollowFilterMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current
          .mutateAsync({
            filterSnapshot: snapshot,
            filterWhere: {},
            label: '技術:React',
          })
          .catch(() => undefined);
      });

      expect(invalidateSpy).not.toHaveBeenCalled();
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useUnfollowMutation', () => {
    it('calls unfollowFilter with the given id', async () => {
      unfollowFilter.mockResolvedValue(undefined);

      const { result } = renderHook(() => useUnfollowMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('sub-1');
      });

      expect(unfollowFilter).toHaveBeenCalledWith('sub-1');
    });

    it('on success invalidates the ["job-filter-watchlist", "list"] query', async () => {
      unfollowFilter.mockResolvedValue(undefined);
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useUnfollowMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('sub-1');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['job-filter-watchlist', 'list'],
      });
    });
  });

  describe('useMarkViewedMutation', () => {
    it('calls markWatchlistViewed with the given id', async () => {
      markWatchlistViewed.mockResolvedValue(subscription);

      const { result } = renderHook(() => useMarkViewedMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('sub-1');
      });

      expect(markWatchlistViewed).toHaveBeenCalledWith('sub-1');
    });

    it('on success invalidates the ["job-filter-watchlist", "list"] query', async () => {
      markWatchlistViewed.mockResolvedValue(subscription);
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useMarkViewedMutation(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('sub-1');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['job-filter-watchlist', 'list'],
      });
    });
  });
});
