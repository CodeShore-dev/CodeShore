import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseTable } from '@codeshore/data-types';

type AiSuggestionRow = SupabaseTable.AiSuggestion;

type FakePostgrestError = {
  code: string;
  message: string;
};

type FakeInsertResponse = {
  data: AiSuggestionRow | AiSuggestionRow[] | null;
  error: FakePostgrestError | null;
};

/**
 * Minimal fake PostgREST-style query builder, following the pattern
 * established by `mv_company_tech.spec.ts`: it supports exactly the chains
 * exercised by `AiSuggestionService` --
 *   - `insert(...).select().single()` for `createPendingSuggestion`
 *   - `select().filter().order().range()` (via `fetchAll`) for
 *     `listByTargetAndStatus`
 * and is awaitable (thenable) like the real supabase-js builder.
 *
 * Insert responses are queued via `insertResponses` so a test can simulate
 * a Postgres unique-violation (`code: '23505'`) on a specific call without
 * needing a real database or in-memory constraint enforcement.
 */
function createFakeBuilder(options: {
  rows: AiSuggestionRow[];
  insertResponses: FakeInsertResponse[];
  updateError?: FakePostgrestError | null;
}) {
  const { rows, insertResponses } = options;
  let filtered = [...rows];
  let pendingInsert: FakeInsertResponse | null = null;
  // `markApproved`'s conditional-update chain: `update(values).eq(...).eq(...)
  // .select().maybeSingle()`. Tracked separately from the insert/select state
  // above so both call shapes can coexist on the same fake builder, following
  // the write-chain pattern established by `tech_parent.spec.ts`.
  let mode: 'select' | 'update' = 'select';
  let updateValues: Partial<AiSuggestionRow> | null = null;
  let eqFilters: Array<[string, unknown]> = [];

  const builder: any = {
    url: new URL('https://example.test/ai_suggestion'),
    insert(records: AiSuggestionRow[]) {
      pendingInsert = insertResponses.shift() ?? {
        data: records,
        error: null,
      };
      return builder;
    },
    update(values: Partial<AiSuggestionRow>) {
      mode = 'update';
      updateValues = values;
      eqFilters = [];
      return builder;
    },
    eq(column: string, value: unknown) {
      eqFilters.push([column, value]);
      return builder;
    },
    maybeSingle() {
      return builder;
    },
    select() {
      // A fresh snapshot on every `select()` call (rather than only at
      // builder creation) so a `fetchAll()` issued after a prior
      // `markApproved()` write on this same builder instance observes the
      // mutated `rows` array instead of a stale pre-write snapshot.
      filtered = [...rows];
      return builder;
    },
    single() {
      return builder;
    },
    filter(column: string, operator: string, value: unknown) {
      if (operator === 'eq') {
        filtered = filtered.filter(
          row => (row as any)[column] === value,
        );
      } else if (operator === 'gte') {
        filtered = filtered.filter(
          row => (row as any)[column] >= value,
        );
      } else if (operator === 'lte') {
        filtered = filtered.filter(
          row => (row as any)[column] <= value,
        );
      }
      return builder;
    },
    or(conditions: string) {
      // Mirrors the `status.eq.approved,status.eq.rejected`-style
      // PostgREST `or()` string built by `listByTargetAndStatus` for a
      // multi-value `status` filter (see `_fetchList`'s `$or` handling in
      // `shared-services/supabase/utils.ts`).
      const clauses = conditions
        .split(',')
        .map(clause => clause.split('.'));
      filtered = filtered.filter(row =>
        clauses.some(([col, operator, value]) => {
          if (operator === 'eq') {
            return String((row as any)[col]) === value;
          }
          return false;
        }),
      );
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
    then(resolve: (value: any) => void) {
      if (pendingInsert) {
        const response = pendingInsert;
        pendingInsert = null;
        const data = response.error
          ? null
          : Array.isArray(response.data)
            ? (response.data[0] ?? null)
            : response.data;
        resolve({
          data,
          count: null,
          error: response.error,
          status: response.error ? 409 : 201,
        });
        return;
      }
      if (mode === 'update') {
        mode = 'select';
        if (options.updateError) {
          resolve({
            data: null,
            error: options.updateError,
            status: 500,
            count: null,
          });
          return;
        }
        let matched: AiSuggestionRow | null = null;
        rows.forEach((row, idx) => {
          if (
            eqFilters.every(
              ([col, val]) => (row as any)[col] === val,
            )
          ) {
            rows[idx] = {
              ...row,
              ...(updateValues as Partial<AiSuggestionRow>),
            };
            matched = rows[idx];
          }
        });
        resolve({
          data: matched,
          error: null,
          status: 200,
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

function createFakeClient(options: {
  rows: AiSuggestionRow[];
  insertResponses: FakeInsertResponse[];
  updateError?: FakePostgrestError | null;
}): SupabaseClient {
  const fakeBuilder = createFakeBuilder(options);
  return {
    from() {
      return fakeBuilder;
    },
  } as unknown as SupabaseClient;
}

const baseSuggestionInput = {
  target_table: 'tech_keyword' as const,
  workflow: 'keyword_mapping' as const,
  action: 'insert' as const,
  target_key: { tech: 'react', keyword: 'reactjs' },
  payload: { tech: 'react', keyword: 'reactjs' },
  evidence: { reasoning: 'reactjs is a common alias for react', confidence: 0.9 },
};

const storedRow: AiSuggestionRow = {
  id: 'suggestion-1',
  target_table: baseSuggestionInput.target_table,
  workflow: baseSuggestionInput.workflow,
  action: baseSuggestionInput.action,
  target_key: baseSuggestionInput.target_key,
  payload: baseSuggestionInput.payload,
  evidence: baseSuggestionInput.evidence,
  status: 'pending',
  flagged_for_review: false,
  created_at: '2026-07-07T00:00:00.000Z',
  reviewed_by: null,
  reviewed_at: null,
  resolution_note: null,
  outcome: null,
};

let fakeRows: AiSuggestionRow[] = [];
let fakeInsertResponses: FakeInsertResponse[] = [];
let fakeUpdateError: FakePostgrestError | null = null;

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () =>
    createFakeClient({
      rows: fakeRows,
      insertResponses: fakeInsertResponses,
      updateError: fakeUpdateError,
    }),
}));

describe('AiSuggestionService', () => {
  beforeEach(() => {
    fakeRows = [];
    fakeInsertResponses = [];
    fakeUpdateError = null;
  });

  describe('createPendingSuggestion', () => {
    it('creates a pending suggestion and returns the stored record', async () => {
      fakeInsertResponses = [{ data: storedRow, error: null }];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.createPendingSuggestion(
        baseSuggestionInput,
      );

      expect(result).toEqual({
        outcome: 'created',
        record: storedRow,
      });
    });

    it('returns a duplicate result instead of throwing when the partial unique index rejects a second pending insert', async () => {
      fakeInsertResponses = [
        {
          data: null,
          error: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "ux_ai_suggestion_pending_target"',
          },
        },
      ];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.createPendingSuggestion(
        baseSuggestionInput,
      );

      expect(result).toEqual({
        outcome: 'duplicate',
        targetTable: baseSuggestionInput.target_table,
        workflow: baseSuggestionInput.workflow,
        targetKey: baseSuggestionInput.target_key,
      });
    });

    it('surfaces other Postgres errors as a clean error result rather than throwing', async () => {
      fakeInsertResponses = [
        {
          data: null,
          error: {
            code: '23514',
            message: 'new row violates check constraint "ai_suggestion_workflow_check"',
          },
        },
      ];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.createPendingSuggestion(
        baseSuggestionInput,
      );

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect(result.error.code).toBe('23514');
      }
    });
  });

  describe('listByTargetAndStatus', () => {
    it('filters by target table and status', async () => {
      fakeRows = [
        storedRow,
        {
          ...storedRow,
          id: 'suggestion-2',
          target_table: 'tech',
          workflow: 'tech_dictionary',
          status: 'approved',
        },
        {
          ...storedRow,
          id: 'suggestion-3',
          status: 'rejected',
        },
      ];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const { result, count } = await service.listByTargetAndStatus({
        targetTable: 'tech_keyword',
        status: 'pending',
      });

      expect(result).toEqual([storedRow]);
      expect(count).toBe(1);
    });

    it('returns an empty list rather than an error when nothing matches', async () => {
      fakeRows = [storedRow];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const { result, count } = await service.listByTargetAndStatus({
        targetTable: 'location_group',
      });

      expect(result).toEqual([]);
      expect(count).toBe(0);
    });
  });

  describe('markApproved', () => {
    it('transitions a pending suggestion to approved and writes the review/outcome metadata', async () => {
      fakeRows = [storedRow];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const outcome = {
        affectedViews: ['mv_tech'],
        beforeCounts: { mv_tech: 10 },
        afterCounts: { mv_tech: 11 },
        exceedsExpectedMagnitude: false,
      };
      const result = await service.markApproved('suggestion-1', {
        payload: { tech: 'react', keyword: 'reactjs2' },
        reviewedBy: 'reviewer-1',
        resolutionNote: null,
        outcome,
        flaggedForReview: false,
      });

      expect(result.outcome).toBe('approved');
      if (result.outcome === 'approved') {
        expect(result.record.status).toBe('approved');
        expect(result.record.reviewed_by).toBe('reviewer-1');
        expect(result.record.payload).toEqual({
          tech: 'react',
          keyword: 'reactjs2',
        });
        expect(result.record.outcome).toEqual(outcome);
        expect(typeof result.record.reviewed_at).toBe('string');
      }

      // the change is visible on the next query, not just in the returned row
      const { result: rows } = await service.fetchAll({
        where: { id: { eq: 'suggestion-1' } },
      });
      expect(rows[0].status).toBe('approved');
    });

    it('returns not_pending without changing the row when the suggestion is already approved', async () => {
      fakeRows = [{ ...storedRow, status: 'approved' }];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markApproved('suggestion-1', {
        payload: { tech: 'react', keyword: 'reactjs2' },
        reviewedBy: 'reviewer-1',
        resolutionNote: null,
        outcome: null,
        flaggedForReview: false,
      });

      expect(result).toEqual({ outcome: 'not_pending' });
      expect(fakeRows[0].payload).toEqual(storedRow.payload);
    });

    it('returns not_pending without changing the row when the suggestion is already rejected', async () => {
      fakeRows = [{ ...storedRow, status: 'rejected' }];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markApproved('suggestion-1', {
        payload: {},
        reviewedBy: 'reviewer-1',
        resolutionNote: null,
        outcome: null,
        flaggedForReview: false,
      });

      expect(result).toEqual({ outcome: 'not_pending' });
    });

    it('returns not_pending when the id does not exist at all', async () => {
      fakeRows = [storedRow];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markApproved('does-not-exist', {
        payload: {},
        reviewedBy: 'reviewer-1',
        resolutionNote: null,
        outcome: null,
        flaggedForReview: false,
      });

      expect(result).toEqual({ outcome: 'not_pending' });
    });
  });

  describe('markRejected', () => {
    it('transitions a pending suggestion to rejected and writes only the review metadata', async () => {
      fakeRows = [storedRow];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markRejected('suggestion-1', {
        reviewerId: 'reviewer-1',
        note: 'not a real alias',
      });

      expect(result.outcome).toBe('rejected');
      if (result.outcome === 'rejected') {
        expect(result.record.status).toBe('rejected');
        expect(result.record.reviewed_by).toBe('reviewer-1');
        expect(result.record.resolution_note).toBe('not a real alias');
        expect(typeof result.record.reviewed_at).toBe('string');
        // approve-only fields are left untouched
        expect(result.record.payload).toEqual(storedRow.payload);
        expect(result.record.flagged_for_review).toBe(false);
        expect(result.record.outcome).toBeNull();
      }

      // the change is visible on the next query, not just in the returned row
      const { result: rows } = await service.fetchAll({
        where: { id: { eq: 'suggestion-1' } },
      });
      expect(rows[0].status).toBe('rejected');
    });

    it('returns not_pending without changing the row when the suggestion is already approved', async () => {
      fakeRows = [{ ...storedRow, status: 'approved' }];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markRejected('suggestion-1', {
        reviewerId: 'reviewer-1',
        note: 'note',
      });

      expect(result).toEqual({ outcome: 'not_pending' });
      expect(fakeRows[0].status).toBe('approved');
    });

    it('returns not_pending without changing the row when the suggestion is already rejected', async () => {
      fakeRows = [{ ...storedRow, status: 'rejected' }];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markRejected('suggestion-1', {
        reviewerId: 'reviewer-1',
        note: 'note',
      });

      expect(result).toEqual({ outcome: 'not_pending' });
    });

    it('returns not_pending when the id does not exist at all', async () => {
      fakeRows = [storedRow];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markRejected('does-not-exist', {
        reviewerId: 'reviewer-1',
        note: 'note',
      });

      expect(result).toEqual({ outcome: 'not_pending' });
    });

    it('surfaces a genuine database error distinctly from not_pending, without changing the row', async () => {
      fakeRows = [storedRow];
      fakeUpdateError = {
        code: '500',
        message: 'connection to database lost',
      };
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const result = await service.markRejected('suggestion-1', {
        reviewerId: 'reviewer-1',
        note: 'note',
      });

      expect(result.outcome).toBe('error');
      if (result.outcome === 'error') {
        expect(result.error.message).toBe('connection to database lost');
      }
      expect(fakeRows[0].status).toBe('pending');
    });
  });

  describe('listByTargetAndStatus (history queries)', () => {
    const approvedRow: AiSuggestionRow = {
      ...storedRow,
      id: 'suggestion-approved',
      status: 'approved',
      created_at: '2026-02-15T00:00:00.000Z',
      reviewed_by: 'reviewer-1',
      reviewed_at: '2026-02-15T01:00:00.000Z',
    };
    const rejectedRow: AiSuggestionRow = {
      ...storedRow,
      id: 'suggestion-rejected',
      status: 'rejected',
      created_at: '2026-02-20T00:00:00.000Z',
      reviewed_by: 'reviewer-1',
      reviewed_at: '2026-02-20T01:00:00.000Z',
      resolution_note: 'not needed',
    };
    const pendingRow: AiSuggestionRow = {
      ...storedRow,
      id: 'suggestion-pending',
      status: 'pending',
      created_at: '2026-02-16T00:00:00.000Z',
    };
    const outOfRangeApprovedRow: AiSuggestionRow = {
      ...storedRow,
      id: 'suggestion-old-approved',
      status: 'approved',
      created_at: '2026-01-01T00:00:00.000Z',
    };

    it('returns both approved and rejected rows within a created_at time range, excluding rows outside it and still-pending rows', async () => {
      fakeRows = [
        approvedRow,
        rejectedRow,
        pendingRow,
        outOfRangeApprovedRow,
      ];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const { result } = await service.listByTargetAndStatus({
        status: ['approved', 'rejected'],
        createdAfter: '2026-02-01T00:00:00.000Z',
        createdBefore: '2026-02-28T00:00:00.000Z',
      });

      expect(result.map(row => row.id).sort()).toEqual(
        ['suggestion-approved', 'suggestion-rejected'].sort(),
      );
    });

    it('combines targetTable with the time range', async () => {
      const otherTableApproved: AiSuggestionRow = {
        ...approvedRow,
        id: 'suggestion-other-table',
        target_table: 'tech',
      };
      fakeRows = [approvedRow, rejectedRow, otherTableApproved];
      const { AiSuggestionService } = await import('./ai_suggestion.service');
      const service = new AiSuggestionService();

      const { result } = await service.listByTargetAndStatus({
        targetTable: 'tech_keyword',
        status: ['approved', 'rejected'],
        createdAfter: '2026-02-01T00:00:00.000Z',
        createdBefore: '2026-02-28T00:00:00.000Z',
      });

      expect(result.map(row => row.id).sort()).toEqual(
        ['suggestion-approved', 'suggestion-rejected'].sort(),
      );
    });
  });
});
