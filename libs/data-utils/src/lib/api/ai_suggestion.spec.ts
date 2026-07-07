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
}) {
  const { rows, insertResponses } = options;
  let filtered = [...rows];
  let pendingInsert: FakeInsertResponse | null = null;

  const builder: any = {
    url: new URL('https://example.test/ai_suggestion'),
    insert(records: AiSuggestionRow[]) {
      pendingInsert = insertResponses.shift() ?? {
        data: records,
        error: null,
      };
      return builder;
    },
    select() {
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

vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () =>
    createFakeClient({
      rows: fakeRows,
      insertResponses: fakeInsertResponses,
    }),
}));

describe('AiSuggestionService', () => {
  beforeEach(() => {
    fakeRows = [];
    fakeInsertResponses = [];
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
});
