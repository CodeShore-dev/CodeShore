import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fake in-memory rows for the `mv_company_tech` materialized view.
 */
const rows = [
  { company_id: 'company-1', tech: 'python', job_count: 3 },
  { company_id: 'company-1', tech: 'typescript', job_count: 10 },
  { company_id: 'company-1', tech: 'go', job_count: 6 },
  { company_id: 'company-2', tech: 'java', job_count: 2 },
];

/**
 * Minimal fake PostgREST-style query builder that supports exactly the
 * chain used by `fetchList`/`_fetchList`: select -> filter -> order -> range,
 * and is awaitable (thenable) like the real supabase-js builder.
 */
function createFakeBuilder(data: typeof rows) {
  let filtered = [...data];
  const builder: any = {
    url: new URL('https://example.test/mv_company_tech'),
    select() {
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

function createFakeClient(data: typeof rows): SupabaseClient {
  const fakeBuilder = createFakeBuilder(data);
  return {
    from() {
      return fakeBuilder;
    },
  } as unknown as SupabaseClient;
}

// `MvCompanyTechService` follows the same pattern as every other sibling
// service in this directory (e.g. `MvCompanyService`): its constructor takes
// only an optional logger and resolves its Supabase client internally via
// `getSupabaseClient()`. To keep that constructor signature identical to its
// siblings (no test-only client injection parameter), the module is mocked
// here so `getSupabaseClient()` returns our in-memory fake builder instead of
// requiring real Supabase credentials.
vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => createFakeClient(rows),
}));

describe('MvCompanyTechService', () => {
  it('returns technologies for a known company sorted by job_count descending', async () => {
    const { MvCompanyTechService } = await import(
      './mv_company_tech'
    );
    const service = new MvCompanyTechService();

    const { result } = await service.fetchAll({
      where: { company_id: { eq: 'company-1' } },
      orders: [{ column: 'job_count', ascending: false }],
    });

    expect(result).toEqual([
      { company_id: 'company-1', tech: 'typescript', job_count: 10 },
      { company_id: 'company-1', tech: 'go', job_count: 6 },
      { company_id: 'company-1', tech: 'python', job_count: 3 },
    ]);
  });

  it('returns an empty list rather than an error for an id with no matches', async () => {
    const { MvCompanyTechService } = await import(
      './mv_company_tech'
    );
    const service = new MvCompanyTechService();

    const { result, count } = await service.fetchAll({
      where: { company_id: { eq: 'company-does-not-exist' } },
      orders: [{ column: 'job_count', ascending: false }],
    });

    expect(result).toEqual([]);
    expect(count).toBe(0);
  });
});
