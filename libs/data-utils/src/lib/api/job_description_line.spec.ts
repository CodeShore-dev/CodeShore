import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';

type Row = SupabaseTable.JobDescriptionLine;

/**
 * Minimal fake in-memory PostgREST-style query builder, following the
 * pattern established by `location_group.spec.ts` / `ai_suggestion.spec.ts`,
 * extended to also support the chains exercised by the inherited
 * `TableService.reset()` (`delete().neq(idField, '')` then `insert(records)`)
 * on top of the usual `select().filter().order().range()` read chain used by
 * `fetchAll`. `JobDescriptionLineService` adds no custom methods, so this
 * spec exercises the inherited `reset()`/`fetchAll()` shape directly (task
 * 1.1's "完成狀態": the class compiles and behaves like every other plain
 * `TableService` subclass in this directory).
 */
function createFakeBuilder(rows: Row[]) {
  let filtered = [...rows];
  let mode: 'select' | 'insert' | 'delete' = 'select';
  let insertPayload: Row[] | null = null;
  let eqFilters: Array<[string, unknown]> = [];
  let neqFilters: Array<[string, unknown]> = [];
  let inFilters: Array<[string, unknown[]]> = [];

  const builder: any = {
    url: new URL('https://example.test/job_description_line'),
    select() {
      mode = 'select';
      filtered = [...rows];
      return builder;
    },
    filter(column: string, operator: string, value: unknown) {
      if (operator === 'eq') {
        filtered = filtered.filter(row => (row as any)[column] === value);
      }
      return builder;
    },
    order(column: string, opts: { ascending: boolean }) {
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
    insert(records: Row[]) {
      mode = 'insert';
      insertPayload = records;
      return builder;
    },
    delete() {
      mode = 'delete';
      eqFilters = [];
      neqFilters = [];
      inFilters = [];
      return builder;
    },
    eq(column: string, value: unknown) {
      eqFilters.push([column, value]);
      return builder;
    },
    neq(column: string, value: unknown) {
      neqFilters.push([column, value]);
      return builder;
    },
    in(column: string, values: unknown[]) {
      if (mode === 'select') {
        filtered = filtered.filter(row => values.includes((row as any)[column]));
      } else {
        inFilters.push([column, values]);
      }
      return builder;
    },
    then(resolve: (value: any) => void) {
      if (mode === 'insert') {
        for (const record of insertPayload as Row[]) {
          rows.push({ ...record });
        }
        mode = 'select';
        resolve({
          data: insertPayload,
          error: null,
          status: 201,
          count: null,
        });
        return;
      }
      if (mode === 'delete') {
        // Mirrors the real `deleteAll` helper: a plain `.neq(idField, '')`
        // matches every row (all real ids are non-empty strings), so a
        // `reset()` truncates the whole table before re-inserting. A
        // `.in(column, values)` delete (`deleteWhereIn`/`replaceWhereIn`)
        // only removes rows whose `column` is one of `values`.
        for (let i = rows.length - 1; i >= 0; i--) {
          const matchesNeq = neqFilters.every(
            ([col, val]) => (rows[i] as any)[col] !== val,
          );
          const matchesEq = eqFilters.every(
            ([col, val]) => (rows[i] as any)[col] === val,
          );
          const matchesIn = inFilters.every(
            ([col, vals]) => vals.includes((rows[i] as any)[col]),
          );
          if (matchesNeq && matchesEq && matchesIn) {
            rows.splice(i, 1);
          }
        }
        mode = 'select';
        resolve({ data: null, error: null, status: 204, count: null });
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

function makeRow(overrides: Partial<Row>): Row {
  return {
    id: 'line-1',
    job_id: 'job-a',
    line_no: 1,
    content: 'React 前端工程師',
    created_at: '2026-07-13T00:00:00.000Z',
    ...overrides,
  } as Row;
}

let fakeRows: Row[] = [];

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => createFakeClient(fakeRows),
}));

describe('JobDescriptionLineService', () => {
  beforeEach(() => {
    fakeRows = [];
  });

  describe('fetchAll', () => {
    it('returns lines for a job filtered by job_id, in line order', async () => {
      fakeRows = [
        makeRow({ id: 'line-2', job_id: 'job-a', line_no: 2, content: '3 年以上經驗' }),
        makeRow({ id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師' }),
        makeRow({ id: 'line-3', job_id: 'job-b', line_no: 1, content: '不相關的 job' }),
      ];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      const { result } = await service.fetchAll({
        where: { job_id: { eq: 'job-a' } },
        orders: [{ column: 'line_no', ascending: true }],
      });

      expect(result.map(row => row.content)).toEqual([
        'React 前端工程師',
        '3 年以上經驗',
      ]);
    });

    it('returns an empty list for a job with no lines', async () => {
      fakeRows = [makeRow({ id: 'line-1', job_id: 'job-b' })];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      const { result } = await service.fetchAll({
        where: { job_id: { eq: 'job-does-not-exist' } },
      });

      expect(result).toEqual([]);
    });
  });

  describe('reset', () => {
    it('replaces all previously stored lines with the newly provided batch', async () => {
      fakeRows = [
        makeRow({ id: 'stale-1', job_id: 'job-a', line_no: 1, content: 'stale line' }),
      ];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      await service.reset([
        makeRow({ id: 'line-1', job_id: 'job-a', line_no: 1, content: 'React 前端工程師' }),
        makeRow({ id: 'line-2', job_id: 'job-a', line_no: 2, content: '3 年以上經驗' }),
      ]);

      const { result } = await service.fetchAll({
        where: { job_id: { eq: 'job-a' } },
        orders: [{ column: 'line_no', ascending: true }],
      });
      expect(result.map(row => row.content)).toEqual([
        'React 前端工程師',
        '3 年以上經驗',
      ]);
      expect(result.find(row => row.id === 'stale-1')).toBeUndefined();
    });

    it('leaves an empty table when reset with no records', async () => {
      fakeRows = [makeRow({ id: 'line-1', job_id: 'job-a' })];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      await service.reset([]);

      const { result } = await service.fetchAll();
      expect(result).toEqual([]);
    });
  });

  describe('findWhereIn', () => {
    it('returns rows whose job_id is one of the given values, across multiple jobs', async () => {
      fakeRows = [
        makeRow({ id: 'line-1', job_id: 'job-a' }),
        makeRow({ id: 'line-2', job_id: 'job-b' }),
        makeRow({ id: 'line-3', job_id: 'job-c' }),
      ];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      const { result } = await service.findWhereIn('job_id', ['job-a', 'job-c']);

      expect(result.map(row => row.id).sort()).toEqual(['line-1', 'line-3']);
    });

    it('returns an empty result without matching anything when values is empty', async () => {
      fakeRows = [makeRow({ id: 'line-1', job_id: 'job-a' })];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      const { result } = await service.findWhereIn('job_id', []);

      expect(result).toEqual([]);
    });
  });

  describe('replaceWhereIn', () => {
    it('replaces only the rows scoped to the given job_ids, leaving other jobs untouched', async () => {
      fakeRows = [
        makeRow({ id: 'stale-a', job_id: 'job-a', content: 'stale a' }),
        makeRow({ id: 'keep-b', job_id: 'job-b', content: 'untouched b' }),
      ];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      await service.replaceWhereIn('job_id', ['job-a'], [
        makeRow({ id: 'fresh-a', job_id: 'job-a', content: 'fresh a' }),
      ]);

      const { result } = await service.fetchAll();
      expect(result.map(row => row.id).sort()).toEqual(['fresh-a', 'keep-b']);
    });

    it('is a no-op delete (and no insert) when scopeValues is empty and records is empty', async () => {
      fakeRows = [makeRow({ id: 'keep-a', job_id: 'job-a' })];
      const { JobDescriptionLineService } = await import(
        './job_description_line.service'
      );
      const service = new JobDescriptionLineService();

      await service.replaceWhereIn('job_id', [], []);

      const { result } = await service.fetchAll();
      expect(result.map(row => row.id)).toEqual(['keep-a']);
    });
  });
});
