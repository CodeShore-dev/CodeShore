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
    upsert,
    __mocks: { single, select, upsert },
  };
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
    const service = new Service(subscriptionService as any);

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
    const service = new Service(subscriptionService as any);

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
    const service = new Service(subscriptionService as any);

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
    const service = new Service(subscriptionService as any);

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
      const service = new Service(subscriptionService as any);

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
    const service = new Service(subscriptionService as any);

    await expect(
      service.create('user-1', {
        filterSnapshot: makeSnapshot(),
        filterWhere: {},
        label: 'My filter',
      }),
    ).rejects.toBe(insertError);
  });
});
