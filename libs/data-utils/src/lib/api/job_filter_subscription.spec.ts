import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';
import type { JobFilterSnapshot } from '@codeshore/shared-utils';

type Row = SupabaseTable.JobFilterSubscription;

type FakeSelectOptions = {
  head?: boolean;
  count?: 'exact' | 'planned' | 'estimated';
};

/**
 * Minimal fake in-memory PostgREST-style query builder, following the
 * pattern established by `location_group.spec.ts` / `ai_suggestion.spec.ts`,
 * sized to exactly the chains `JobFilterSubscriptionService` exercises:
 *   - `select().eq('user_id', ...).order(...)` for `findByUser`
 *   - `select().eq('user_id', ...).eq('filter_snapshot', ...).maybeSingle()`
 *     for `findByUserAndSnapshot`
 *   - `select('*', { count: 'exact', head: true }).eq('user_id', ...)` for
 *     `countByUser`
 *   - `delete().eq('user_id', ...).eq('id', ...)` for `deleteByUserAndId`
 *   - `update(values).eq('user_id', ...).eq('id', ...).select().maybeSingle()`
 *     for `touchLastViewedAt`
 *
 * `filter_snapshot` is a jsonb column, so `eq()` filtering against it needs
 * value (deep) equality rather than the reference equality used for scalar
 * columns elsewhere in the codebase's fake builders.
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null
  ) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function createFakeBuilder(rows: Row[]) {
  let filtered = [...rows];
  let mode: 'select' | 'update' | 'delete' = 'select';
  let selectOptions: FakeSelectOptions | undefined;
  let updateValues: Partial<Row> | null = null;
  let eqFilters: Array<[string, unknown]> = [];
  let wantsMaybeSingle = false;
  let wantsSelectOnDelete = false;

  const applyEqFilters = () => {
    filtered = filtered.filter(row =>
      eqFilters.every(([col, val]) =>
        valuesEqual((row as any)[col], val),
      ),
    );
  };

  const builder: any = {
    url: new URL('https://example.test/job_filter_subscription'),
    select(_columns?: string, options?: FakeSelectOptions) {
      // Only reset the filter/mode state when this is a fresh top-level
      // query (`mode` is still its default `'select'`). When `.select()`
      // is chained onto an in-progress `update(...).eq(...).eq(...)` (as
      // in `touchLastViewedAt`), `mode` is already `'update'` at this
      // point and must be preserved, along with the `eq()` filters already
      // pushed -- otherwise the update's ownership scoping is silently
      // dropped. Mirrors the write-chain handling in
      // `ai_suggestion.spec.ts`'s fake builder.
      if (mode === 'select') {
        filtered = [...rows];
        eqFilters = [];
        wantsMaybeSingle = false;
      }
      if (mode === 'delete') {
        // `.delete().eq(...).eq(...).select()` (as `deleteByUserAndId`
        // uses) -- preserve the delete's filters, but remember that the
        // caller wants the deleted row(s) reported back as `data` instead
        // of the bare `{ data: null }` PostgREST returns for a plain
        // delete.
        wantsSelectOnDelete = true;
      }
      selectOptions = options;
      return builder;
    },
    update(values: Partial<Row>) {
      mode = 'update';
      updateValues = values;
      eqFilters = [];
      wantsMaybeSingle = false;
      return builder;
    },
    delete() {
      mode = 'delete';
      eqFilters = [];
      wantsSelectOnDelete = false;
      return builder;
    },
    eq(column: string, value: unknown) {
      eqFilters.push([column, value]);
      return builder;
    },
    order(
      column: string,
      opts: { ascending: boolean },
    ) {
      filtered = [...filtered].sort((a, b) => {
        const av = (a as any)[column];
        const bv = (b as any)[column];
        const direction = opts.ascending ? 1 : -1;
        if (av < bv) return -1 * direction;
        if (av > bv) return 1 * direction;
        return 0;
      });
      return builder;
    },
    maybeSingle() {
      wantsMaybeSingle = true;
      return builder;
    },
    then(resolve: (value: any) => void) {
      if (mode === 'delete') {
        applyEqFilters();
        const deleted: Row[] = [];
        for (let i = rows.length - 1; i >= 0; i--) {
          if (
            eqFilters.every(([col, val]) =>
              valuesEqual((rows[i] as any)[col], val),
            )
          ) {
            deleted.unshift(rows[i]);
            rows.splice(i, 1);
          }
        }
        mode = 'select';
        resolve({
          data: wantsSelectOnDelete ? deleted : null,
          error: null,
          status: wantsSelectOnDelete ? 200 : 204,
          count: null,
        });
        return;
      }
      if (mode === 'update') {
        let matched: Row | null = null;
        rows.forEach((row, idx) => {
          if (
            eqFilters.every(([col, val]) =>
              valuesEqual((row as any)[col], val),
            )
          ) {
            rows[idx] = { ...row, ...(updateValues as Partial<Row>) };
            matched = rows[idx];
          }
        });
        mode = 'select';
        resolve({
          data: wantsMaybeSingle
            ? matched
            : rows.filter(row =>
                eqFilters.every(([col, val]) =>
                  valuesEqual((row as any)[col], val),
                ),
              ),
          error: null,
          status: 200,
          count: null,
        });
        return;
      }
      // select
      if (selectOptions?.head && selectOptions.count === 'exact') {
        applyEqFilters();
        resolve({
          data: null,
          error: null,
          status: 200,
          count: filtered.length,
        });
        return;
      }
      applyEqFilters();
      if (wantsMaybeSingle) {
        resolve({
          data: filtered[0] ?? null,
          error: null,
          status: 200,
          count: null,
        });
        return;
      }
      resolve({
        data: filtered,
        error: null,
        status: 200,
        count: filtered.length,
      });
    },
  };
  return builder;
}

function createFakeClient(rows: Row[]): SupabaseClient {
  const fakeBuilder = createFakeBuilder(rows);
  return {
    from() {
      return fakeBuilder;
    },
  } as unknown as SupabaseClient;
}

const userAId = 'user-a';
const userBId = 'user-b';

const baseSnapshot: JobFilterSnapshot = {
  searchText: 'react',
  companyFilters: [{ name: 'acme', mode: 'include' }],
  salaryFilter: 'none',
  salaryAmount: { type: '', amount: null },
  selectedLocations: ['taipei'],
  selectedTags: ['react'],
  excludedTags: [],
  techOperator: 'and',
};

const otherSnapshot: JobFilterSnapshot = {
  ...baseSnapshot,
  searchText: 'vue',
};

function makeRow(overrides: Partial<Row>): Row {
  return {
    id: 'sub-1',
    user_id: userAId,
    filter_snapshot: baseSnapshot as unknown as Record<string, unknown>,
    filter_where: { id: { eq: 'acme' } },
    label: 'React jobs at Acme',
    last_viewed_at: '2026-07-01T00:00:00.000Z',
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Row;
}

let fakeRows: Row[] = [];

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => createFakeClient(fakeRows),
}));

describe('JobFilterSubscriptionService', () => {
  beforeEach(() => {
    fakeRows = [];
  });

  describe('findByUser', () => {
    it('returns only the requesting user\'s subscriptions', async () => {
      fakeRows = [
        makeRow({ id: 'sub-a1', user_id: userAId }),
        makeRow({ id: 'sub-a2', user_id: userAId }),
        makeRow({ id: 'sub-b1', user_id: userBId }),
      ];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.findByUser(userAId);

      expect(result.map(row => row.id).sort()).toEqual([
        'sub-a1',
        'sub-a2',
      ]);
    });

    it('returns an empty list when the user has no subscriptions', async () => {
      fakeRows = [makeRow({ id: 'sub-b1', user_id: userBId })];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.findByUser(userAId);

      expect(result).toEqual([]);
    });
  });

  describe('findByUserAndSnapshot', () => {
    it('finds a matching subscription owned by the requesting user', async () => {
      fakeRows = [
        makeRow({
          id: 'sub-a1',
          user_id: userAId,
          filter_snapshot: baseSnapshot as unknown as Record<
            string,
            unknown
          >,
        }),
      ];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.findByUserAndSnapshot(
        userAId,
        baseSnapshot,
      );

      expect(result?.id).toBe('sub-a1');
    });

    it('does not return a matching snapshot owned by a different user', async () => {
      fakeRows = [
        makeRow({
          id: 'sub-b1',
          user_id: userBId,
          filter_snapshot: baseSnapshot as unknown as Record<
            string,
            unknown
          >,
        }),
      ];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.findByUserAndSnapshot(
        userAId,
        baseSnapshot,
      );

      expect(result).toBeNull();
    });

    it('returns null when the snapshot does not match any owned subscription', async () => {
      fakeRows = [
        makeRow({
          id: 'sub-a1',
          user_id: userAId,
          filter_snapshot: otherSnapshot as unknown as Record<
            string,
            unknown
          >,
        }),
      ];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.findByUserAndSnapshot(
        userAId,
        baseSnapshot,
      );

      expect(result).toBeNull();
    });
  });

  describe('countByUser', () => {
    it('counts only the requesting user\'s subscriptions', async () => {
      fakeRows = [
        makeRow({ id: 'sub-a1', user_id: userAId }),
        makeRow({ id: 'sub-a2', user_id: userAId }),
        makeRow({ id: 'sub-b1', user_id: userBId }),
        makeRow({ id: 'sub-b2', user_id: userBId }),
        makeRow({ id: 'sub-b3', user_id: userBId }),
      ];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const count = await service.countByUser(userAId);

      expect(count).toBe(2);
    });

    it('returns 0 for a user with no subscriptions', async () => {
      fakeRows = [];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const count = await service.countByUser(userAId);

      expect(count).toBe(0);
    });
  });

  describe('deleteByUserAndId', () => {
    it('deletes a subscription owned by the requesting user and returns true', async () => {
      fakeRows = [makeRow({ id: 'sub-a1', user_id: userAId })];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.deleteByUserAndId(userAId, 'sub-a1');

      expect(result).toBe(true);
      expect(fakeRows).toEqual([]);
    });

    it('does not delete a subscription owned by a different user and returns false', async () => {
      fakeRows = [makeRow({ id: 'sub-b1', user_id: userBId })];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.deleteByUserAndId(userAId, 'sub-b1');

      expect(result).toBe(false);
      expect(fakeRows).toHaveLength(1);
      expect(fakeRows[0].id).toBe('sub-b1');
    });

    it('returns false when the id does not exist at all', async () => {
      fakeRows = [];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.deleteByUserAndId(
        userAId,
        'does-not-exist',
      );

      expect(result).toBe(false);
    });
  });

  describe('touchLastViewedAt', () => {
    it('updates last_viewed_at to now for a subscription owned by the requesting user', async () => {
      fakeRows = [
        makeRow({
          id: 'sub-a1',
          user_id: userAId,
          last_viewed_at: '2020-01-01T00:00:00.000Z',
        }),
      ];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const before = Date.now();
      const result = await service.touchLastViewedAt(userAId, 'sub-a1');
      const after = Date.now();

      expect(result).not.toBeNull();
      const updatedAt = new Date(
        result?.last_viewed_at as string,
      ).getTime();
      expect(updatedAt).toBeGreaterThanOrEqual(before);
      expect(updatedAt).toBeLessThanOrEqual(after);
      expect(fakeRows[0].last_viewed_at).toBe(result?.last_viewed_at);
    });

    it('returns null and leaves the row untouched when the subscription is owned by a different user', async () => {
      fakeRows = [
        makeRow({
          id: 'sub-b1',
          user_id: userBId,
          last_viewed_at: '2020-01-01T00:00:00.000Z',
        }),
      ];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.touchLastViewedAt(userAId, 'sub-b1');

      expect(result).toBeNull();
      expect(fakeRows[0].last_viewed_at).toBe('2020-01-01T00:00:00.000Z');
    });

    it('returns null when the id does not exist at all', async () => {
      fakeRows = [];
      const { JobFilterSubscriptionService } = await import(
        './job_filter_subscription.service'
      );
      const service = new JobFilterSubscriptionService();

      const result = await service.touchLastViewedAt(
        userAId,
        'does-not-exist',
      );

      expect(result).toBeNull();
    });
  });
});
