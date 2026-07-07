import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';

type Row = SupabaseTable.LocationGroup_.Location;

/**
 * Minimal fake in-memory PostgREST-style query builder, following the
 * pattern established by `mv_company_tech.spec.ts` / `ai_suggestion.spec.ts`,
 * extended to also support the write chains exercised by
 * `LocationGroupLocationService`:
 *   - `upsert(records)` for insert
 *   - `update(values).eq(col, val).eq(col, val)` for
 *     `updateByGroupAndLocation`
 *   - `delete().eq(col, val).eq(col, val)` for `deleteByGroupAndLocation`
 *   - `select().filter().order().range()` (via `fetchAll`) to observe the
 *     effect of a write on the next query
 * `rows` is mutated in place so a test can insert/update/delete and then
 * `fetchAll` again to see the change take effect.
 */
function createFakeBuilder(rows: Row[]) {
  let filtered = [...rows];
  let mode: 'select' | 'upsert' | 'update' | 'delete' = 'select';
  let writePayload: Partial<Row> | Row[] | null = null;
  let eqFilters: Array<[string, unknown]> = [];

  const builder: any = {
    url: new URL(
      'https://example.test/location_group_location',
    ),
    select() {
      mode = 'select';
      filtered = [...rows];
      return builder;
    },
    filter(column: string, operator: string, value: unknown) {
      if (operator === 'eq') {
        filtered = filtered.filter(
          row => (row as any)[column] === value,
        );
      }
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
    range() {
      return builder;
    },
    upsert(records: Row[]) {
      mode = 'upsert';
      writePayload = records;
      return builder;
    },
    update(values: Partial<Row>) {
      mode = 'update';
      writePayload = values;
      eqFilters = [];
      return builder;
    },
    delete() {
      mode = 'delete';
      eqFilters = [];
      return builder;
    },
    eq(column: string, value: unknown) {
      eqFilters.push([column, value]);
      return builder;
    },
    then(resolve: (value: any) => void) {
      if (mode === 'upsert') {
        for (const record of writePayload as Row[]) {
          const idx = rows.findIndex(
            row =>
              row.location_group === record.location_group &&
              row.location === record.location,
          );
          if (idx >= 0) rows[idx] = { ...rows[idx], ...record };
          else rows.push({ ...record });
        }
        mode = 'select';
        resolve({
          data: writePayload,
          error: null,
          status: 201,
          count: null,
        });
        return;
      }
      if (mode === 'update') {
        rows.forEach((row, idx) => {
          if (
            eqFilters.every(
              ([col, val]) => (row as any)[col] === val,
            )
          ) {
            rows[idx] = {
              ...row,
              ...(writePayload as Partial<Row>),
            };
          }
        });
        mode = 'select';
        resolve({
          data: null,
          error: null,
          status: 204,
          count: null,
        });
        return;
      }
      if (mode === 'delete') {
        for (let i = rows.length - 1; i >= 0; i--) {
          if (
            eqFilters.every(
              ([col, val]) => (rows[i] as any)[col] === val,
            )
          ) {
            rows.splice(i, 1);
          }
        }
        mode = 'select';
        resolve({
          data: null,
          error: null,
          status: 204,
          count: null,
        });
        return;
      }
      resolve({
        data: filtered,
        count: filtered.length,
        error: null,
        status: 200,
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

let fakeRows: Row[] = [];

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => createFakeClient(fakeRows),
}));

describe('LocationGroupLocationService', () => {
  beforeEach(() => {
    fakeRows = [
      { location_group: 'taipei', location: '台北市' },
    ];
  });

  it('inserts a new mapping and makes it visible on the next query', async () => {
    const { LocationGroupLocationService } = await import(
      './location_group_location.service'
    );
    const service = new LocationGroupLocationService();

    const { error } = await service.upsert([
      { location_group: 'taipei', location: '臺北市' },
    ]);
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { location: { eq: '臺北市' } },
    });
    expect(result).toEqual([
      { location_group: 'taipei', location: '臺北市' },
    ]);
  });

  it('updates an existing mapping to point at a different group and the change is visible on the next query', async () => {
    const { LocationGroupLocationService } = await import(
      './location_group_location.service'
    );
    const service = new LocationGroupLocationService();

    const { error } = await service.updateByGroupAndLocation(
      'taipei',
      '台北市',
      { location_group: 'taipei-city' },
    );
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { location: { eq: '台北市' } },
    });
    expect(result).toEqual([
      { location_group: 'taipei-city', location: '台北市' },
    ]);
  });

  it('deletes exactly one mapping and the change is visible on the next query', async () => {
    fakeRows = [
      { location_group: 'taipei', location: '台北市' },
      { location_group: 'taipei', location: '臺北市' },
    ];
    const { LocationGroupLocationService } = await import(
      './location_group_location.service'
    );
    const service = new LocationGroupLocationService();

    const { error } = await service.deleteByGroupAndLocation(
      'taipei',
      '台北市',
    );
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { location_group: { eq: 'taipei' } },
    });
    expect(result).toEqual([
      { location_group: 'taipei', location: '臺北市' },
    ]);
  });
});
