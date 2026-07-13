import { HttpStatus, NotFoundException } from '@nestjs/common';
import { LoggerModule } from '@codeshore/service-logger';
import { Test } from '@nestjs/testing';
import { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JobFilterSnapshot } from '@codeshore/shared-utils';

import { Controller } from './controller';
import { Module } from './module';
import { Service, SubscriptionWithCounts } from './service';

const user = { id: 'user-1' } as User;

const defaultSnapshot: JobFilterSnapshot = {
  searchText: '',
  companyFilters: [],
  salaryFilter: 'none',
  salaryAmount: { type: '', amount: null },
  selectedLocations: [],
  selectedTags: [],
  excludedTags: [],
  techOperator: 'and',
};

function makeSubscription(
  overrides: Partial<SubscriptionWithCounts> = {},
): SubscriptionWithCounts {
  return {
    id: 'sub-1',
    label: 'My filter',
    filterSnapshot: defaultSnapshot,
    lastViewedAt: '2026-07-12T00:00:00.000Z',
    createdAt: '2026-07-12T00:00:00.000Z',
    totalCount: 0,
    newCount: 0,
    ...overrides,
  };
}

/**
 * Mocks the Express `Response` surface `Controller.create` writes to
 * directly (see controller.ts's doc comment for why: this repo's global
 * `InboundInterceptor`/`AllExceptionsFilter` and Nest's own per-route static
 * status-code resolution make design.md's conditional 201/200/409 POST
 * response unreachable via the normal "return a value" convention). `status`
 * returns `this` to support the chained `res.status(x).json(y)` call.
 */
function makeResMock() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('Controller.create (task 2.4, design.md POST /api/job-filter-watchlist)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responds 201 with { data: subscription } when Service.create reports status: created', async () => {
    const subscription = makeSubscription({ id: 'new-sub' });
    const service = {
      create: vi.fn().mockResolvedValue({ status: 'created', subscription }),
    };
    const controller = new Controller(service as unknown as Service);
    const res = makeResMock();
    const body = {
      filterSnapshot: {} as any,
      filterWhere: {},
      label: 'My filter',
    };

    await controller.create(body, user, res as any);

    expect(service.create).toHaveBeenCalledWith('user-1', body);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(res.json).toHaveBeenCalledWith({
      code: HttpStatus.OK,
      message: undefined,
      data: subscription,
    });
  });

  it('responds 200 with { data: subscription } when Service.create reports status: already_exists (requirement 1.3)', async () => {
    const subscription = makeSubscription({ id: 'existing-sub' });
    const service = {
      create: vi
        .fn()
        .mockResolvedValue({ status: 'already_exists', subscription }),
    };
    const controller = new Controller(service as unknown as Service);
    const res = makeResMock();
    const body = {
      filterSnapshot: {} as any,
      filterWhere: {},
      label: 'My filter',
    };

    await controller.create(body, user, res as any);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith({
      code: HttpStatus.OK,
      message: undefined,
      data: subscription,
    });
  });

  it('responds 409 with the exact { code: WATCHLIST_LIMIT_REACHED, limit } body when Service.create reports status: limit_reached (requirement 5.2)', async () => {
    const service = {
      create: vi
        .fn()
        .mockResolvedValue({ status: 'limit_reached', limit: 20 }),
    };
    const controller = new Controller(service as unknown as Service);
    const res = makeResMock();
    const body = {
      filterSnapshot: {} as any,
      filterWhere: {},
      label: 'My filter',
    };

    await controller.create(body, user, res as any);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(res.json).toHaveBeenCalledWith({
      code: 'WATCHLIST_LIMIT_REACHED',
      limit: 20,
    });
  });
});

describe('Controller.list (design.md GET /api/job-filter-watchlist)', () => {
  it("returns Service.list(user.id)'s result exactly (requirement 2.1, 7.2)", async () => {
    const subscriptions = [makeSubscription(), makeSubscription({ id: 'sub-2' })];
    const service = { list: vi.fn().mockResolvedValue(subscriptions) };
    const controller = new Controller(service as unknown as Service);

    const result = await controller.list(user);

    expect(service.list).toHaveBeenCalledWith('user-1');
    expect(result).toBe(subscriptions);
  });
});

describe('Controller.markViewed (design.md PATCH /api/job-filter-watchlist/:id/viewed)', () => {
  it('returns the refreshed subscription when Service.markViewed finds a match (requirement 3.2)', async () => {
    const subscription = makeSubscription({ id: 'sub-1' });
    const service = { markViewed: vi.fn().mockResolvedValue(subscription) };
    const controller = new Controller(service as unknown as Service);

    const result = await controller.markViewed('sub-1', user);

    expect(service.markViewed).toHaveBeenCalledWith('user-1', 'sub-1');
    expect(result).toBe(subscription);
  });

  it('throws NotFoundException (404) when Service.markViewed returns null (requirement 7.2: wrong owner or nonexistent id)', async () => {
    const service = { markViewed: vi.fn().mockResolvedValue(null) };
    const controller = new Controller(service as unknown as Service);

    await expect(
      controller.markViewed('someone-elses-sub', user),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(service.markViewed).toHaveBeenCalledWith(
      'user-1',
      'someone-elses-sub',
    );
  });
});

describe('Controller.remove (design.md DELETE /api/job-filter-watchlist/:id)', () => {
  it('completes without error (204) when Service.remove returns true (requirement 4.1)', async () => {
    const service = { remove: vi.fn().mockResolvedValue(true) };
    const controller = new Controller(service as unknown as Service);

    await expect(
      controller.remove('sub-1', user),
    ).resolves.toBeUndefined();

    expect(service.remove).toHaveBeenCalledWith('user-1', 'sub-1');
  });

  it('throws NotFoundException (404) when Service.remove returns false (requirement 7.2: wrong owner or nonexistent id)', async () => {
    const service = { remove: vi.fn().mockResolvedValue(false) };
    const controller = new Controller(service as unknown as Service);

    await expect(
      controller.remove('nonexistent-or-not-owned', user),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(service.remove).toHaveBeenCalledWith(
      'user-1',
      'nonexistent-or-not-owned',
    );
  });
});

describe('Module wiring (task 2.4)', () => {
  it('boots the job-filter-watchlist Module (Controller + Service + data-utils providers) without error', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), Module],
    }).compile();

    expect(moduleRef.get(Controller)).toBeInstanceOf(Controller);
    expect(moduleRef.get(Service)).toBeInstanceOf(Service);

    await moduleRef.close();
  });
});
