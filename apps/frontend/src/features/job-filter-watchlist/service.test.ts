import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../httpClient', () => ({
  httpClient: { get, post, patch, delete: del },
}));

import {
  fetchWatchlist,
  followFilter,
  isWatchlistLimitReachedError,
  markWatchlistViewed,
  unfollowFilter,
} from './service';

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
  filterSnapshot: snapshot,
  lastViewedAt: '2026-07-12T00:00:00.000Z',
  createdAt: '2026-07-12T00:00:00.000Z',
  totalCount: 10,
  newCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('followFilter', () => {
  it('POSTs /api/job-filter-watchlist with { filterSnapshot, filterWhere, label } and returns the subscription', async () => {
    post.mockResolvedValue({ data: subscription });

    const result = await followFilter(snapshot, { tags: { cs: ['reactjs'] } }, '技術:React');

    expect(post).toHaveBeenCalledWith('/api/job-filter-watchlist', {
      filterSnapshot: snapshot,
      filterWhere: { tags: { cs: ['reactjs'] } },
      label: '技術:React',
    });
    expect(result).toEqual(subscription);
  });

  it('lets a 409 WATCHLIST_LIMIT_REACHED rejection propagate to the caller', async () => {
    const error = new AxiosError(
      'Request failed with status code 409',
      '409',
      undefined,
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: { code: 'WATCHLIST_LIMIT_REACHED', limit: 20 },
      },
    );
    post.mockRejectedValue(error);

    await expect(
      followFilter(snapshot, {}, '技術:React'),
    ).rejects.toBe(error);
  });
});

describe('isWatchlistLimitReachedError', () => {
  it('returns true for a 409 response with code WATCHLIST_LIMIT_REACHED', () => {
    const error = new AxiosError(
      'Request failed with status code 409',
      '409',
      undefined,
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: { code: 'WATCHLIST_LIMIT_REACHED', limit: 20 },
      },
    );

    expect(isWatchlistLimitReachedError(error)).toBe(true);
  });

  it('returns false for a non-409 axios error', () => {
    const error = new AxiosError(
      'Request failed with status code 500',
      '500',
      undefined,
      undefined,
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: { code: 'SOMETHING_ELSE' },
      },
    );

    expect(isWatchlistLimitReachedError(error)).toBe(false);
  });

  it('returns false for a plain Error', () => {
    expect(isWatchlistLimitReachedError(new Error('network down'))).toBe(
      false,
    );
  });

  it('returns false for a 409 response with a different code', () => {
    const error = new AxiosError(
      'Request failed with status code 409',
      '409',
      undefined,
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: { code: 'SOME_OTHER_CONFLICT' },
      },
    );

    expect(isWatchlistLimitReachedError(error)).toBe(false);
  });
});

describe('fetchWatchlist', () => {
  it('GETs /api/job-filter-watchlist and returns the subscription list', async () => {
    get.mockResolvedValue({ data: [subscription] });

    const result = await fetchWatchlist();

    expect(get).toHaveBeenCalledWith('/api/job-filter-watchlist');
    expect(result).toEqual([subscription]);
  });
});

describe('markWatchlistViewed', () => {
  it('PATCHes /api/job-filter-watchlist/:id/viewed and returns the refreshed subscription', async () => {
    patch.mockResolvedValue({ data: subscription });

    const result = await markWatchlistViewed('sub-1');

    expect(patch).toHaveBeenCalledWith(
      '/api/job-filter-watchlist/sub-1/viewed',
    );
    expect(result).toEqual(subscription);
  });

  it('URL-encodes the id path segment', async () => {
    patch.mockResolvedValue({ data: subscription });

    await markWatchlistViewed('sub 1/x');

    expect(patch).toHaveBeenCalledWith(
      '/api/job-filter-watchlist/sub%201%2Fx/viewed',
    );
  });
});

describe('unfollowFilter', () => {
  it('DELETEs /api/job-filter-watchlist/:id', async () => {
    del.mockResolvedValue({ data: undefined });

    await unfollowFilter('sub-1');

    expect(del).toHaveBeenCalledWith('/api/job-filter-watchlist/sub-1');
  });

  it('URL-encodes the id path segment', async () => {
    del.mockResolvedValue({ data: undefined });

    await unfollowFilter('sub 1/x');

    expect(del).toHaveBeenCalledWith(
      '/api/job-filter-watchlist/sub%201%2Fx',
    );
  });
});
