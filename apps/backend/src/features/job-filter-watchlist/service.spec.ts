import { JobFilterSnapshot } from '@codeshore/shared-utils';

import { Service } from './service';

function makeSnapshot(
  overrides: Partial<JobFilterSnapshot> = {},
): JobFilterSnapshot {
  return {
    searchText: '  backend  ',
    companyFilters: [
      { name: 'zeta', mode: 'include' },
      { name: 'alpha', mode: 'exclude' },
    ],
    salaryFilter: 'none',
    salaryAmount: { type: '', amount: null },
    selectedLocations: ['taipei', 'hsinchu'],
    selectedTags: ['react', 'node'],
    excludedTags: ['php'],
    techOperator: 'and',
    ...overrides,
  };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    user_id: 'user-1',
    filter_snapshot: {},
    filter_where: {},
    label: 'My filter',
    last_viewed_at: '2026-07-12T00:00:00.000Z',
    created_at: '2026-07-12T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Builds a mock `JobFilterSubscriptionService` whose `upsert(...)` mimics
 * `TableService.upsert`'s chainable-query-builder return shape
 * (`.upsert(records).select().single()`), resolving to `{ data, error }`.
 */
function makeSubscriptionServiceMock(options: {
  findByUserAndSnapshot?: unknown;
  countByUser?: number;
  insertedRow?: Record<string, unknown>;
  insertError?: unknown;
  findByUser?: Record<string, unknown>[];
  touchLastViewedAt?: Record<string, unknown> | null;
  deleteByUserAndId?: boolean;
}) {
  const single = vi.fn().mockResolvedValue({
    data: options.insertedRow ?? null,
    error: options.insertError ?? null,
  });
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));

  return {
    findByUserAndSnapshot: vi
      .fn()
      .mockResolvedValue(options.findByUserAndSnapshot ?? null),
    countByUser: vi.fn().mockResolvedValue(options.countByUser ?? 0),
    findByUser: vi.fn().mockResolvedValue(options.findByUser ?? []),
    upsert,
    touchLastViewedAt: vi
      .fn()
      .mockResolvedValue(options.touchLastViewedAt ?? null),
    deleteByUserAndId: vi
      .fn()
      .mockResolvedValue(options.deleteByUserAndId ?? true),
    __mocks: { single, select, upsert },
  };
}

/**
 * Builds a mock `MvJobService` whose `fetchMvJobsByUserAndPreference`
 * resolves to a fixed `count` for every call, recording the `(query, userId)`
 * arguments it was called with so tests can assert the exact `where` object
 * and range each count query used (design.md "Count 計算": reuse the
 * existing query path rather than a new one).
 */
function makeMvJobServiceMock(countsByCallIndex: number[]) {
  let callIndex = 0;
  const fetchMvJobsByUserAndPreference = vi.fn(() => {
    const count = countsByCallIndex[callIndex] ?? 0;
    callIndex += 1;
    return Promise.resolve({ result: [], count, searchParams: '' });
  });
  return { fetchMvJobsByUserAndPreference };
}

/**
 * Builds a mock `CacheService`. `getOrSet` defaults to always-miss (invokes
 * and returns `fn()`, mirroring a real cache miss) so tests exercise the
 * underlying computation; pass `cachedValue` to simulate a cache hit instead
 * (resolves immediately without calling `fn`).
 */
function makeCacheServiceMock(options: { cachedValue?: unknown } = {}) {
  const getOrSet = vi.fn((_key: string, fn: () => Promise<unknown>) =>
    options.cachedValue !== undefined
      ? Promise.resolve(options.cachedValue)
      : fn(),
  );
  const invalidate = vi.fn().mockResolvedValue(undefined);
  return { getOrSet, invalidate };
}

describe('Service.create', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns already_exists and does not insert when a matching subscription already exists for the user', async () => {
    const existingRow = makeRow({ id: 'existing-sub' });
    const subscriptionService = makeSubscriptionServiceMock({
      findByUserAndSnapshot: existingRow,
    });
    const service = new Service(
      subscriptionService as any,
      {} as any,
      {} as any,
    );

    const result = await service.create('user-1', {
      filterSnapshot: makeSnapshot(),
      filterWhere: { searchText: { ilike: '%backend%' } },
      label: 'My filter',
    });

    expect(result).toEqual({
      status: 'already_exists',
      subscription: {
        id: 'existing-sub',
        label: 'My filter',
        lastViewedAt: '2026-07-12T00:00:00.000Z',
        createdAt: '2026-07-12T00:00:00.000Z',
        totalCount: 0,
        newCount: 0,
      },
    });
    expect(subscriptionService.countByUser).not.toHaveBeenCalled();
    expect(subscriptionService.upsert).not.toHaveBeenCalled();
  });

  it('normalizes the filter snapshot before checking for a duplicate', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      findByUserAndSnapshot: makeRow(),
    });
    const service = new Service(
      subscriptionService as any,
      {} as any,
      {} as any,
    );

    await service.create('user-1', {
      filterSnapshot: makeSnapshot(),
      filterWhere: {},
      label: 'My filter',
    });

    expect(subscriptionService.findByUserAndSnapshot).toHaveBeenCalledWith(
      'user-1',
      {
        searchText: 'backend',
        companyFilters: [
          { name: 'alpha', mode: 'exclude' },
          { name: 'zeta', mode: 'include' },
        ],
        salaryFilter: 'none',
        salaryAmount: { type: '', amount: null },
        selectedLocations: ['hsinchu', 'taipei'],
        selectedTags: ['node', 'react'],
        excludedTags: ['php'],
        techOperator: 'and',
      },
    );
  });

  it('returns limit_reached and does not insert when the user is at the subscription limit', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      findByUserAndSnapshot: null,
      countByUser: 20,
    });
    const service = new Service(
      subscriptionService as any,
      {} as any,
      {} as any,
    );

    const result = await service.create('user-1', {
      filterSnapshot: makeSnapshot(),
      filterWhere: {},
      label: 'My filter',
    });

    expect(result).toEqual({ status: 'limit_reached', limit: 20 });
    expect(subscriptionService.upsert).not.toHaveBeenCalled();
  });

  it('returns limit_reached when the user is above the subscription limit', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      findByUserAndSnapshot: null,
      countByUser: 21,
    });
    const service = new Service(
      subscriptionService as any,
      {} as any,
      {} as any,
    );

    const result = await service.create('user-1', {
      filterSnapshot: makeSnapshot(),
      filterWhere: {},
      label: 'My filter',
    });

    expect(result).toEqual({ status: 'limit_reached', limit: 20 });
  });

  it('creates a new subscription with last_viewed_at set to the creation time when no duplicate exists and the user is under the limit', async () => {
    const creationTime = '2026-07-12T03:04:05.000Z';
    vi.useFakeTimers();
    vi.setSystemTime(new Date(creationTime));

    try {
      const insertedRow = makeRow({
        id: 'new-sub',
        label: 'My filter',
        last_viewed_at: creationTime,
        created_at: creationTime,
      });
      const subscriptionService = makeSubscriptionServiceMock({
        findByUserAndSnapshot: null,
        countByUser: 19,
        insertedRow,
      });
      const cacheService = makeCacheServiceMock();
      const service = new Service(
      subscriptionService as any,
      {} as any,
      cacheService as any,
    );

      const filterWhere = { searchText: { ilike: '%backend%' } };
      const result = await service.create('user-1', {
        filterSnapshot: makeSnapshot(),
        filterWhere,
        label: 'My filter',
      });

      expect(subscriptionService.upsert).toHaveBeenCalledTimes(1);
      const [[records]] = subscriptionService.upsert.mock.calls;
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        user_id: 'user-1',
        filter_where: filterWhere,
        label: 'My filter',
      });
      expect(typeof records[0].id).toBe('string');
      expect(records[0].id.length).toBeGreaterThan(0);
      // last_viewed_at is set to the creation time (the fixed, independently
      // known fake-clock value), not left for the DB default.
      expect(records[0].last_viewed_at).toBe(creationTime);
      expect(records[0].filter_snapshot).toEqual({
        searchText: 'backend',
        companyFilters: [
          { name: 'alpha', mode: 'exclude' },
          { name: 'zeta', mode: 'include' },
        ],
        salaryFilter: 'none',
        salaryAmount: { type: '', amount: null },
        selectedLocations: ['hsinchu', 'taipei'],
        selectedTags: ['node', 'react'],
        excludedTags: ['php'],
        techOperator: 'and',
      });

      expect(result).toEqual({
        status: 'created',
        subscription: {
          id: 'new-sub',
          label: 'My filter',
          lastViewedAt: creationTime,
          createdAt: creationTime,
          totalCount: 0,
          newCount: 0,
        },
      });
      // A newly-created row changes the user's followed list, so the
      // cached counts list must be invalidated (design.md "Count 計算").
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        'job-filter-watchlist-counts:user-1',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('propagates an error from the insert instead of returning a created result', async () => {
    const insertError = new Error('unique_violation');
    const subscriptionService = makeSubscriptionServiceMock({
      findByUserAndSnapshot: null,
      countByUser: 0,
      insertError,
    });
    const service = new Service(
      subscriptionService as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.create('user-1', {
        filterSnapshot: makeSnapshot(),
        filterWhere: {},
        label: 'My filter',
      }),
    ).rejects.toBe(insertError);
  });
});

describe('Service.list', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes totalCount/newCount for each subscription by reusing MvJobService with the stored filter_where', async () => {
    const filterWhere = { searchText: { ilike: '%backend%' } };
    const row = makeRow({
      id: 'sub-1',
      filter_where: filterWhere,
      last_viewed_at: '2026-07-10T00:00:00.000Z',
    });
    const subscriptionService = makeSubscriptionServiceMock({
      findByUser: [row],
    });
    // First call (per subscription) answers totalCount, second answers
    // newCount -- see the assertions below for which `where` object each
    // call must have used.
    const mvJobService = makeMvJobServiceMock([7, 3]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.list('user-1');

    expect(subscriptionService.findByUser).toHaveBeenCalledWith('user-1');
    expect(
      mvJobService.fetchMvJobsByUserAndPreference,
    ).toHaveBeenCalledTimes(2);

    const [totalCall, newCall] =
      mvJobService.fetchMvJobsByUserAndPreference.mock.calls;
    // totalCount: the stored filter_where, unmodified, count-only range.
    expect(totalCall).toEqual([
      { where: filterWhere, from: 0, to: 0 },
      null,
    ]);
    // newCount: same filter_where plus created_at gt last_viewed_at.
    expect(newCall).toEqual([
      {
        where: {
          ...filterWhere,
          created_at: { gt: '2026-07-10T00:00:00.000Z' },
        },
        from: 0,
        to: 0,
      },
      null,
    ]);

    expect(result).toEqual([
      {
        id: 'sub-1',
        label: 'My filter',
        lastViewedAt: '2026-07-10T00:00:00.000Z',
        createdAt: '2026-07-12T00:00:00.000Z',
        totalCount: 7,
        newCount: 3,
      },
    ]);
  });

  it('computes counts for every subscription in the user\'s list, not just the first', async () => {
    const rowA = makeRow({
      id: 'sub-a',
      filter_where: { a: 1 },
      last_viewed_at: '2026-07-01T00:00:00.000Z',
    });
    const rowB = makeRow({
      id: 'sub-b',
      filter_where: { b: 1 },
      last_viewed_at: '2026-07-02T00:00:00.000Z',
    });
    const subscriptionService = makeSubscriptionServiceMock({
      findByUser: [rowA, rowB],
    });
    // sub-a: total=1, new=0 -- sub-b: total=5, new=2
    const mvJobService = makeMvJobServiceMock([1, 0, 5, 2]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.list('user-1');

    expect(
      mvJobService.fetchMvJobsByUserAndPreference,
    ).toHaveBeenCalledTimes(4);
    expect(result).toEqual([
      expect.objectContaining({ id: 'sub-a', totalCount: 1, newCount: 0 }),
      expect.objectContaining({ id: 'sub-b', totalCount: 5, newCount: 2 }),
    ]);
  });

  it('caches the computed list under job-filter-watchlist-counts:${userId} with a 60s TTL via CacheService.getOrSet', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      findByUser: [makeRow({ id: 'sub-1' })],
    });
    const mvJobService = makeMvJobServiceMock([0, 0]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    await service.list('user-42');

    expect(cacheService.getOrSet).toHaveBeenCalledTimes(1);
    const [key, , opts] = cacheService.getOrSet.mock.calls[0];
    expect(key).toBe('job-filter-watchlist-counts:user-42');
    expect(opts).toEqual({ ttl: 60 * 1000 });
  });

  it('returns the cached value directly on a cache hit without recomputing', async () => {
    const cachedValue = [
      {
        id: 'sub-cached',
        label: 'Cached',
        lastViewedAt: '2026-07-01T00:00:00.000Z',
        createdAt: '2026-07-01T00:00:00.000Z',
        totalCount: 42,
        newCount: 1,
      },
    ];
    const subscriptionService = makeSubscriptionServiceMock({});
    const mvJobService = makeMvJobServiceMock([]);
    const cacheService = makeCacheServiceMock({ cachedValue });
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.list('user-1');

    expect(result).toBe(cachedValue);
    expect(subscriptionService.findByUser).not.toHaveBeenCalled();
    expect(
      mvJobService.fetchMvJobsByUserAndPreference,
    ).not.toHaveBeenCalled();
  });

  it('returns an empty array without querying MvJobService when the user follows nothing', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      findByUser: [],
    });
    const mvJobService = makeMvJobServiceMock([]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.list('user-1');

    expect(result).toEqual([]);
    expect(
      mvJobService.fetchMvJobsByUserAndPreference,
    ).not.toHaveBeenCalled();
  });
});

describe('Service.invalidateCountsCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidates the job-filter-watchlist-counts:${userId} cache key', async () => {
    const subscriptionService = makeSubscriptionServiceMock({});
    const mvJobService = makeMvJobServiceMock([]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    await service.invalidateCountsCache('user-7');

    expect(cacheService.invalidate).toHaveBeenCalledWith(
      'job-filter-watchlist-counts:user-7',
    );
  });
});

describe('Service.markViewed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates last_viewed_at to now, returns the enriched subscription, and invalidates the counts cache when the subscription belongs to the user (Req 3.2)', async () => {
    const filterWhere = { searchText: { ilike: '%backend%' } };
    const touchedRow = makeRow({
      id: 'sub-1',
      filter_where: filterWhere,
      last_viewed_at: '2026-07-12T05:00:00.000Z',
    });
    const subscriptionService = makeSubscriptionServiceMock({
      touchLastViewedAt: touchedRow,
    });
    const mvJobService = makeMvJobServiceMock([7, 2]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.markViewed('user-1', 'sub-1');

    expect(subscriptionService.touchLastViewedAt).toHaveBeenCalledWith(
      'user-1',
      'sub-1',
    );
    // Counts are recomputed using the row returned by touchLastViewedAt --
    // in particular its updated last_viewed_at, not any stale value.
    const [totalCall, newCall] =
      mvJobService.fetchMvJobsByUserAndPreference.mock.calls;
    expect(totalCall).toEqual([
      { where: filterWhere, from: 0, to: 0 },
      null,
    ]);
    expect(newCall).toEqual([
      {
        where: {
          ...filterWhere,
          created_at: { gt: '2026-07-12T05:00:00.000Z' },
        },
        from: 0,
        to: 0,
      },
      null,
    ]);
    expect(result).toEqual({
      id: 'sub-1',
      label: 'My filter',
      lastViewedAt: '2026-07-12T05:00:00.000Z',
      createdAt: '2026-07-12T00:00:00.000Z',
      totalCount: 7,
      newCount: 2,
    });
    expect(cacheService.invalidate).toHaveBeenCalledWith(
      'job-filter-watchlist-counts:user-1',
    );
  });

  it('returns null and does not invalidate the cache when the (userId, id) pair matches no row (wrong owner or nonexistent id) (Req 7.2)', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      touchLastViewedAt: null,
    });
    const mvJobService = makeMvJobServiceMock([]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.markViewed('user-1', 'someone-elses-sub');

    expect(subscriptionService.touchLastViewedAt).toHaveBeenCalledWith(
      'user-1',
      'someone-elses-sub',
    );
    expect(result).toBeNull();
    expect(
      mvJobService.fetchMvJobsByUserAndPreference,
    ).not.toHaveBeenCalled();
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });
});

describe('Service.remove', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes the subscription scoped to the requesting user, invalidates the counts cache, and returns true on a hit (Req 4.1, 7.2)', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      deleteByUserAndId: true,
    });
    const mvJobService = makeMvJobServiceMock([]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.remove('user-1', 'sub-1');

    expect(result).toBe(true);
    expect(subscriptionService.deleteByUserAndId).toHaveBeenCalledWith(
      'user-1',
      'sub-1',
    );
    expect(cacheService.invalidate).toHaveBeenCalledWith(
      'job-filter-watchlist-counts:user-1',
    );
  });

  it('does NOT invalidate the counts cache and returns false when the (userId, id) pair matches no row (wrong owner or nonexistent id)', async () => {
    const subscriptionService = makeSubscriptionServiceMock({
      deleteByUserAndId: false,
    });
    const mvJobService = makeMvJobServiceMock([]);
    const cacheService = makeCacheServiceMock();
    const service = new Service(
      subscriptionService as any,
      mvJobService as any,
      cacheService as any,
    );

    const result = await service.remove('user-1', 'nonexistent-or-not-owned');

    expect(result).toBe(false);
    expect(subscriptionService.deleteByUserAndId).toHaveBeenCalledWith(
      'user-1',
      'nonexistent-or-not-owned',
    );
    expect(cacheService.invalidate).not.toHaveBeenCalled();
  });
});
