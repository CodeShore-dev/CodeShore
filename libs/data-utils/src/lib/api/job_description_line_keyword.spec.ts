import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';

type Row = SupabaseTable.JobDescriptionLineKeyword;

/**
 * Minimal fake in-memory PostgREST-style query builder, following the exact
 * pattern established by `job_description_line.spec.ts` (task 1.1),
 * extended to also support the chains exercised by the inherited
 * `TableService.reset()` (`delete().neq(idField, '')` then `insert(records)`)
 * on top of the usual `select().filter().order().range()` read chain used by
 * `fetchAll`. `JobDescriptionLineKeywordService` adds no custom methods, so
 * this spec exercises the inherited `reset()`/`fetchAll()` shape directly
 * (task 1.2's "完成狀態": the class compiles and behaves like every other
 * plain `TableService` subclass in this directory).
 */
function createFakeBuilder(rows: Row[]) {
  let filtered = [...rows];
  let mode: 'select' | 'insert' | 'delete' = 'select';
  let insertPayload: Row[] | null = null;
  let eqFilters: Array<[string, unknown]> = [];
  let neqFilters: Array<[string, unknown]> = [];
  let inFilters: Array<[string, unknown[]]> = [];

  const builder: any = {
    url: new URL('https://example.test/job_description_line_keyword'),
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
    id: 'review-1',
    line_id: 'line-1',
    rule_keywords: ['React', '前端'],
    ai_status: 'ok',
    ai_is_correct: true,
    final_keywords: ['React', '前端'],
    reviewed_at: '2026-07-13T00:00:00.000Z',
    ...overrides,
  } as Row;
}

let fakeRows: Row[] = [];

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => createFakeClient(fakeRows),
}));

describe('JobDescriptionLineKeywordService', () => {
  beforeEach(() => {
    fakeRows = [];
  });

  describe('fetchAll', () => {
    it('returns review records filtered by line_id', async () => {
      fakeRows = [
        makeRow({ id: 'review-1', line_id: 'line-a' }),
        makeRow({ id: 'review-2', line_id: 'line-b', ai_status: 'failed', ai_is_correct: null }),
      ];
      const { JobDescriptionLineKeywordService } = await import(
        './job_description_line_keyword.service'
      );
      const service = new JobDescriptionLineKeywordService();

      const { result } = await service.fetchAll({
        where: { line_id: { eq: 'line-a' } },
      });

      expect(result.map(row => row.id)).toEqual(['review-1']);
    });

    it('returns an empty list when no review records match', async () => {
      fakeRows = [makeRow({ id: 'review-1', line_id: 'line-a' })];
      const { JobDescriptionLineKeywordService } = await import(
        './job_description_line_keyword.service'
      );
      const service = new JobDescriptionLineKeywordService();

      const { result } = await service.fetchAll({
        where: { line_id: { eq: 'line-does-not-exist' } },
      });

      expect(result).toEqual([]);
    });
  });

  describe('reset', () => {
    it('replaces all previously stored review records with the newly provided batch', async () => {
      fakeRows = [
        makeRow({ id: 'stale-1', line_id: 'line-stale', ai_status: 'failed', ai_is_correct: null }),
      ];
      const { JobDescriptionLineKeywordService } = await import(
        './job_description_line_keyword.service'
      );
      const service = new JobDescriptionLineKeywordService();

      await service.reset([
        makeRow({ id: 'review-1', line_id: 'line-a', ai_status: 'ok', ai_is_correct: true }),
        makeRow({ id: 'review-2', line_id: 'line-b', ai_status: 'failed', ai_is_correct: null, final_keywords: ['React'] }),
      ]);

      const { result } = await service.fetchAll();
      expect(result.map(row => row.id).sort()).toEqual(['review-1', 'review-2']);
      expect(result.find(row => row.id === 'stale-1')).toBeUndefined();
    });

    it('leaves an empty table when reset with no records', async () => {
      fakeRows = [makeRow({ id: 'review-1', line_id: 'line-a' })];
      const { JobDescriptionLineKeywordService } = await import(
        './job_description_line_keyword.service'
      );
      const service = new JobDescriptionLineKeywordService();

      await service.reset([]);

      const { result } = await service.fetchAll();
      expect(result).toEqual([]);
    });
  });

  describe('findWhereIn', () => {
    it('returns review records whose line_id is one of the given values', async () => {
      fakeRows = [
        makeRow({ id: 'review-1', line_id: 'line-a' }),
        makeRow({ id: 'review-2', line_id: 'line-b' }),
        makeRow({ id: 'review-3', line_id: 'line-c' }),
      ];
      const { JobDescriptionLineKeywordService } = await import(
        './job_description_line_keyword.service'
      );
      const service = new JobDescriptionLineKeywordService();

      const { result } = await service.findWhereIn('line_id', ['line-a', 'line-c']);

      expect(result.map(row => row.id).sort()).toEqual(['review-1', 'review-3']);
    });

    it('returns an empty result without matching anything when values is empty', async () => {
      fakeRows = [makeRow({ id: 'review-1', line_id: 'line-a' })];
      const { JobDescriptionLineKeywordService } = await import(
        './job_description_line_keyword.service'
      );
      const service = new JobDescriptionLineKeywordService();

      const { result } = await service.findWhereIn('line_id', []);

      expect(result).toEqual([]);
    });
  });

  describe('replaceWhereIn', () => {
    it('replaces only the review records scoped to the given line_ids, leaving other lines untouched', async () => {
      fakeRows = [
        makeRow({ id: 'stale-a', line_id: 'line-a' }),
        makeRow({ id: 'keep-b', line_id: 'line-b' }),
      ];
      const { JobDescriptionLineKeywordService } = await import(
        './job_description_line_keyword.service'
      );
      const service = new JobDescriptionLineKeywordService();

      await service.replaceWhereIn('line_id', ['line-a'], [
        makeRow({ id: 'fresh-a', line_id: 'line-a' }),
      ]);

      const { result } = await service.fetchAll();
      expect(result.map(row => row.id).sort()).toEqual(['fresh-a', 'keep-b']);
    });
  });
});
