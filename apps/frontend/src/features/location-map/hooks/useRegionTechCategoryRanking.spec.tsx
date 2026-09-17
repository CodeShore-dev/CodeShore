import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `useRegionTechCategoryRanking` reads `../queries`'s
// `useLocationTechStatsQuery` and `../../keyword/queries`'s `useTechsQuery`
// -- mocked at those module boundaries exactly the way
// `useRegionSalaryStats.spec.tsx` mocks `useLocationSalaryStatsQuery` at
// `../queries`, rather than mocking `../service` directly.
const { useLocationTechStatsQuery, useTechsQuery } = vi.hoisted(() => ({
  useLocationTechStatsQuery: vi.fn(),
  useTechsQuery: vi.fn(),
}));

vi.mock('../queries', () => ({ useLocationTechStatsQuery }));
vi.mock('../../keyword/queries', () => ({ useTechsQuery }));

import { useRegionTechCategoryRanking } from './useRegionTechCategoryRanking';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// `useLocationTechStatsQuery` is called twice per render (once with a
// district-scoped `where`, once with the county-tier full-fetch `where: {}`
// -- rules of hooks forbid conditionally calling only one). This helper lets
// each test return the right fixture for whichever call shape the hook under
// test actually relies on for its `tier`.
function mockLocationTechStatsQuery(
  districtRows: Array<{ location: string; tech: string; job_count: number }>,
  countyAllRows: unknown[],
) {
  useLocationTechStatsQuery.mockImplementation((where: Record<string, unknown>) => {
    if (where && 'location' in where) {
      // Mirrors the real backend: `where: { location: { eq: regionId } }`
      // filters server-side, so the mock must filter too rather than
      // returning every row unfiltered.
      const eq = (where.location as { eq?: string } | undefined)?.eq;
      return {
        data: districtRows.filter(row => row.location === eq),
        isLoading: false,
        isError: false,
      };
    }
    return { data: countyAllRows, isLoading: false, isError: false };
  });
}

const TECH_CATALOG = [
  { tech: 'javascript', label: 'JavaScript', category: 'language', icon_slugs: ['javascript'] },
  { tech: 'react', label: 'React', category: 'framework', icon_slugs: ['react'] },
  { tech: 'vue', label: 'Vue', category: 'framework', icon_slugs: ['vue'] },
  { tech: 'angular', label: 'Angular', category: 'framework', icon_slugs: ['angular'] },
  { tech: 'svelte', label: 'Svelte', category: 'framework', icon_slugs: ['svelte'] },
  { tech: 'ember', label: 'Ember', category: 'framework', icon_slugs: ['ember'] },
  { tech: 'backbone', label: 'Backbone', category: 'framework', icon_slugs: ['backbone'] },
  { tech: 'meteor', label: 'Meteor', category: 'framework', icon_slugs: ['meteor'] },
  { tech: 'postgresql', label: 'PostgreSQL', category: 'database', icon_slugs: ['postgresql'] },
  { tech: 'mongodb', label: 'MongoDB', category: 'database', icon_slugs: ['mongodb'] },
];

beforeEach(() => {
  vi.clearAllMocks();
  useTechsQuery.mockReturnValue({ data: TECH_CATALOG, isLoading: false, isError: false });
});

describe('useRegionTechCategoryRanking (regionId === null)', () => {
  it('returns an empty array without querying a specific region', () => {
    mockLocationTechStatsQuery([], []);

    const { result } = renderHook(
      () => useRegionTechCategoryRanking(null, 'district'),
      { wrapper },
    );

    expect(result.current).toEqual([]);
  });
});

describe('useRegionTechCategoryRanking (bucketing correctness)', () => {
  it('groups techs into their catalog category, ordered by CATEGORY_PRIORITY', async () => {
    mockLocationTechStatsQuery(
      [
        { location: '台北市大安區', tech: 'javascript', job_count: 10 },
        { location: '台北市大安區', tech: 'react', job_count: 8 },
        { location: '台北市大安區', tech: 'postgresql', job_count: 5 },
        // Another district's rows must not leak into 台北市大安區's ranking.
        { location: '新北市板橋區', tech: 'mongodb', job_count: 999 },
      ],
      [],
    );

    const { result } = renderHook(
      () => useRegionTechCategoryRanking('台北市大安區', 'district'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(3);
    });

    // CATEGORY_PRIORITY order: language(0) < framework(1) < database(2).
    expect(result.current.map(g => g.category)).toEqual([
      'language',
      'framework',
      'database',
    ]);
    expect(result.current[0]).toEqual({
      category: 'language',
      label: '語言',
      rows: [{ tech: 'javascript', label: 'JavaScript', iconSlugs: ['javascript'], jobCount: 10 }],
    });
    expect(result.current[2]).toEqual({
      category: 'database',
      label: '資料庫',
      rows: [{ tech: 'postgresql', label: 'PostgreSQL', iconSlugs: ['postgresql'], jobCount: 5 }],
    });
  });
});

describe('useRegionTechCategoryRanking (same-category sort + top-5 truncation)', () => {
  it('sorts descending by jobCount within a category and caps it at 5 rows', async () => {
    mockLocationTechStatsQuery(
      [
        { location: '台北市大安區', tech: 'react', job_count: 50 },
        { location: '台北市大安區', tech: 'vue', job_count: 40 },
        { location: '台北市大安區', tech: 'angular', job_count: 30 },
        { location: '台北市大安區', tech: 'svelte', job_count: 20 },
        { location: '台北市大安區', tech: 'ember', job_count: 10 },
        { location: '台北市大安區', tech: 'backbone', job_count: 5 },
        { location: '台北市大安區', tech: 'meteor', job_count: 1 },
      ],
      [],
    );

    const { result } = renderHook(
      () => useRegionTechCategoryRanking('台北市大安區', 'district'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    const framework = result.current[0];
    expect(framework.category).toBe('framework');
    expect(framework.rows).toHaveLength(5);
    expect(framework.rows.map(r => r.tech)).toEqual([
      'react',
      'vue',
      'angular',
      'svelte',
      'ember',
    ]);
    expect(framework.rows.map(r => r.jobCount)).toEqual([50, 40, 30, 20, 10]);
  });
});

describe('useRegionTechCategoryRanking (empty-category exclusion)', () => {
  it('does not include a category whose only rows have zero job_count', async () => {
    mockLocationTechStatsQuery(
      [
        { location: '台北市大安區', tech: 'javascript', job_count: 10 },
        // postgresql has zero open jobs for this district -- must not
        // create/populate a 'database' bucket.
        { location: '台北市大安區', tech: 'postgresql', job_count: 0 },
      ],
      [],
    );

    const { result } = renderHook(
      () => useRegionTechCategoryRanking('台北市大安區', 'district'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });
    expect(result.current.map(g => g.category)).toEqual(['language']);
  });

  it('returns an empty array when the region has no tech rows at all', async () => {
    mockLocationTechStatsQuery([], []);

    const { result } = renderHook(
      () => useRegionTechCategoryRanking('台北市大安區', 'district'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });
});

describe('useRegionTechCategoryRanking (county-tier cross-township aggregation)', () => {
  it('sums job_count for the same tech across every township in the county', async () => {
    mockLocationTechStatsQuery(
      [],
      [
        { location: '新北市板橋區', tech: 'javascript', job_count: 10 },
        { location: '新北市三重區', tech: 'javascript', job_count: 15 },
        // A different county's rows must not leak into 新北市's aggregation.
        { location: '台北市大安區', tech: 'javascript', job_count: 999 },
      ],
    );

    const { result } = renderHook(
      () => useRegionTechCategoryRanking('新北市', 'county'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0]).toEqual({
      category: 'language',
      label: '語言',
      rows: [{ tech: 'javascript', label: 'JavaScript', iconSlugs: ['javascript'], jobCount: 25 }],
    });
  });
});

describe('useRegionTechCategoryRanking (defensive fallback for unrecognized/missing catalog data)', () => {
  it('buckets a tech with no catalog entry, or a null category, under the "others" fallback', async () => {
    mockLocationTechStatsQuery(
      [
        // 'ghost-tech' has job stats but no catalog entry at all.
        { location: '台北市大安區', tech: 'ghost-tech', job_count: 7 },
        // 'no-category-tech' has a catalog entry but a null category.
        { location: '台北市大安區', tech: 'no-category-tech', job_count: 3 },
      ],
      [],
    );
    useTechsQuery.mockReturnValue({
      data: [
        ...TECH_CATALOG,
        { tech: 'no-category-tech', label: '無分類技術', category: null, icon_slugs: null },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(
      () => useRegionTechCategoryRanking('台北市大安區', 'district'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].category).toBe('others');
    expect(result.current[0].label).toBe('其他');
    expect(result.current[0].rows.map(r => r.tech)).toEqual(['ghost-tech', 'no-category-tech']);
  });
});
