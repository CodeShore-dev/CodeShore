import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fake in-memory rows for the `mv_location_tech` materialized view.
 */
const rows = [
  { location: '台北市信義區', tech: 'python', job_count: 3 },
  { location: '台北市信義區', tech: 'typescript', job_count: 10 },
  { location: '台北市信義區', tech: 'go', job_count: 6 },
  { location: '新北市板橋區', tech: 'java', job_count: 2 },
];

/**
 * Minimal fake PostgREST-style query builder that supports exactly the
 * chain used by `fetchList`/`_fetchList`: select -> filter -> order -> range,
 * and is awaitable (thenable) like the real supabase-js builder.
 */
function createFakeBuilder(data: typeof rows) {
  let filtered = [...data];
  const builder: any = {
    url: new URL('https://example.test/mv_location_tech'),
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

// `MvLocationTechService` follows the same pattern as every other sibling
// service in this directory (e.g. `MvCompanyTechService`): its constructor takes
// only an optional logger and resolves its Supabase client internally via
// `getSupabaseClient()`. To keep that constructor signature identical to its
// siblings (no test-only client injection parameter), the module is mocked
// here so `getSupabaseClient()` returns our in-memory fake builder instead of
// requiring real Supabase credentials.
vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => createFakeClient(rows),
}));

describe('MvLocationTechService', () => {
  it('returns technologies for a known location sorted by job_count descending', async () => {
    const { MvLocationTechService } = await import(
      './mv_location_tech'
    );
    const service = new MvLocationTechService();

    const { result } = await service.fetchAll({
      where: { location: { eq: '台北市信義區' } },
      orders: [{ column: 'job_count', ascending: false }],
    });

    expect(result).toEqual([
      { location: '台北市信義區', tech: 'typescript', job_count: 10 },
      { location: '台北市信義區', tech: 'go', job_count: 6 },
      { location: '台北市信義區', tech: 'python', job_count: 3 },
    ]);
  });

  it('returns an empty list rather than an error for a location with no matches', async () => {
    const { MvLocationTechService } = await import(
      './mv_location_tech'
    );
    const service = new MvLocationTechService();

    const { result, count } = await service.fetchAll({
      where: { location: { eq: 'location-does-not-exist' } },
      orders: [{ column: 'job_count', ascending: false }],
    });

    expect(result).toEqual([]);
    expect(count).toBe(0);
  });
});
