import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';

type Row = SupabaseTable.TechParent;

/**
 * Minimal fake in-memory PostgREST-style query builder, following the
 * pattern established by `mv_company_tech.spec.ts` / `ai_suggestion.spec.ts`,
 * extended to also support the write chains exercised by
 * `TechParentService`:
 *   - `upsert(records)` for insert
 *   - `update(values).eq(col, val).eq(col, val)` for
 *     `updateByParentAndChild`
 *   - `delete().eq(col, val).eq(col, val)` for `deleteByParentAndChild`
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
    url: new URL('https://example.test/tech_parent'),
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
              row.parent === record.parent &&
              row.child === record.child,
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

describe('TechParentService', () => {
  beforeEach(() => {
    fakeRows = [{ parent: 'java', child: 'kotlin' }];
  });

  it('inserts a new parent/child edge and makes it visible on the next query', async () => {
    const { TechParentService } = await import(
      './tech_parent.service'
    );
    const service = new TechParentService();

    const { error } = await service.upsert([
      { parent: 'backend', child: 'nestjs' },
    ]);
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { parent: { eq: 'backend' } },
    });
    expect(result).toEqual([
      { parent: 'backend', child: 'nestjs' },
    ]);
  });

  it('updates an existing edge to point at a different child and the change is visible on the next query', async () => {
    const { TechParentService } = await import(
      './tech_parent.service'
    );
    const service = new TechParentService();

    const { error } = await service.updateByParentAndChild(
      'java',
      'kotlin',
      { child: 'scala' },
    );
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { parent: { eq: 'java' } },
    });
    expect(result).toEqual([
      { parent: 'java', child: 'scala' },
    ]);
  });

  it('deletes exactly one edge and the change is visible on the next query', async () => {
    fakeRows = [
      { parent: 'java', child: 'kotlin' },
      { parent: 'java', child: 'scala' },
    ];
    const { TechParentService } = await import(
      './tech_parent.service'
    );
    const service = new TechParentService();

    const { error } = await service.deleteByParentAndChild(
      'java',
      'kotlin',
    );
    expect(error).toBeNull();

    const { result } = await service.fetchAll({
      where: { parent: { eq: 'java' } },
    });
    expect(result).toEqual([
      { parent: 'java', child: 'scala' },
    ]);
  });
});
