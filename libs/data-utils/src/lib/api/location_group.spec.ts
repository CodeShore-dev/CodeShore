import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';

type Row = SupabaseTable.LocationGroup;

/**
 * Minimal fake in-memory PostgREST-style query builder, following the
 * pattern established by `mv_company_tech.spec.ts` / `ai_suggestion.spec.ts`,
 * extended to also support the write chains exercised by
 * `LocationGroupService`:
 *   - `upsert(records)` for insert
 *   - `update(values).eq('id', id)` for `renameId`
 *   - `delete(id)` (inherited `TableService.delete`, `.eq('id', id)`)
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
    url: new URL('https://example.test/location_group'),
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
            row => row.id === record.id,
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

describe('LocationGroupService', () => {
  beforeEach(() => {
    fakeRows = [{ id: 'taipei' }];
  });

  it('inserts a new group and makes it visible on the next query', async () => {
    const { LocationGroupService } = await import(
      './location_group.service'
    );
    const service = new LocationGroupService();

    const { error } = await service.upsert([{ id: 'kaohsiung' }]);
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { id: { eq: 'kaohsiung' } },
    });
    expect(result).toEqual([{ id: 'kaohsiung' }]);
  });

  it('renames an existing group id and the change is visible on the next query', async () => {
    const { LocationGroupService } = await import(
      './location_group.service'
    );
    const service = new LocationGroupService();

    const { error } = await service.renameId(
      'taipei',
      'taipei-city',
    );
    expect(error).toBeNull();

    const { result: oldIdResult } = await service.fetchAll({
      where: { id: { eq: 'taipei' } },
    });
    expect(oldIdResult).toEqual([]);

    const { result: newIdResult } = await service.fetchAll({
      where: { id: { eq: 'taipei-city' } },
    });
    expect(newIdResult).toEqual([{ id: 'taipei-city' }]);
  });

  it('deletes an existing group and the change is visible on the next query', async () => {
    const { LocationGroupService } = await import(
      './location_group.service'
    );
    const service = new LocationGroupService();

    const { error } = await service.delete('taipei');
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { id: { eq: 'taipei' } },
    });
    expect(result).toEqual([]);
  });
});
