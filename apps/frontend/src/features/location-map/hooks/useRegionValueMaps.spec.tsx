import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useLocationGroupsQuery, useLocationTechStatsQuery } = vi.hoisted(
  () => ({
    useLocationGroupsQuery: vi.fn(),
    useLocationTechStatsQuery: vi.fn(),
  }),
);

// `useRegionValueMaps` reuses `../queries`'s re-exported `useLocationGroupsQuery`
// (itself a thin re-export of `features/job/queries.ts`'s hook, per that
// file's own comment) rather than the job feature's `fetchLocationGroups`
// service call -- so this spec mocks at that same boundary, matching how
// `queries.spec.tsx` in this feature mocks `./service` for
// `useLocationTechStatsQuery`. Task 7.2 extends this same hook to also read
// `useLocationTechStatsQuery` (also `../queries`) for the technology view, so
// that hook is mocked here too rather than introducing a second boundary.
vi.mock('../queries', () => ({
  useLocationGroupsQuery,
  useLocationTechStatsQuery,
}));

import { useLocationMapStore } from '../locationMapStore';
import { useRegionValueMaps } from './useRegionValueMaps';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationMapStore.getState().reset();
  // Default stub so the (job count view) describe block below -- which
  // doesn't care about the tech view -- doesn't crash on an unmocked call.
  useLocationTechStatsQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  });
});

describe('useRegionValueMaps (job count view)', () => {
  it('sums job counts of every location_group row into its county total', async () => {
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市大安區', count: 10 },
        { location: '台北市信義區', count: 5 },
        { location: '新北市板橋區', count: 7 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionValueMaps(), { wrapper });

    await waitFor(() => {
      expect(result.current.countyValues.get('台北市')).toBe(15);
    });
    expect(result.current.countyValues.get('新北市')).toBe(7);
  });

  it('excludes rows with an unparseable location from every county total', async () => {
    useLocationGroupsQuery.mockReturnValue({
      data: [
        { location: '台北市大安區', count: 10 },
        // Missing county prefix -- `groupByCounty` drops this row entirely,
        // it must not be folded into any county's total (Requirement 7.2).
        { location: '信義區', count: 999 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionValueMaps(), { wrapper });

    await waitFor(() => {
      expect(result.current.countyValues.get('台北市')).toBe(10);
    });
    expect(result.current.countyValues.size).toBe(1);
    expect([...result.current.countyValues.values()]).not.toContain(999);
  });

  it('returns an empty county map while the underlying query has no data yet', () => {
    useLocationGroupsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { result } = renderHook(() => useRegionValueMaps(), { wrapper });

    expect(result.current.countyValues.size).toBe(0);
  });
});

describe('useRegionValueMaps (tech view, task 7.2)', () => {
  beforeEach(() => {
    // These cases don't exercise the job-count view -- give it an empty,
    // stable dataset so `countyValues` doesn't interfere with assertions on
    // `techCountyValues`.
    useLocationGroupsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  it('sums a selected tech job counts of every location row into its county total', async () => {
    useLocationMapStore.getState().setViewMode('tech');
    useLocationMapStore.getState().setSelectedTech('typescript');
    useLocationTechStatsQuery.mockReturnValue({
      data: [
        { location: '台北市大安區', tech: 'typescript', job_count: 10 },
        { location: '台北市信義區', tech: 'typescript', job_count: 5 },
        { location: '新北市板橋區', tech: 'typescript', job_count: 7 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionValueMaps(), { wrapper });

    expect(useLocationTechStatsQuery).toHaveBeenCalledWith(
      { tech: { eq: 'typescript' } },
      { from: 0, to: -1, enabled: true },
    );
    await waitFor(() => {
      expect(result.current.techCountyValues.get('台北市')).toBe(15);
    });
    expect(result.current.techCountyValues.get('新北市')).toBe(7);
  });

  it('excludes rows with an unparseable location from every county total (tech view)', async () => {
    useLocationMapStore.getState().setViewMode('tech');
    useLocationMapStore.getState().setSelectedTech('typescript');
    useLocationTechStatsQuery.mockReturnValue({
      data: [
        { location: '台北市大安區', tech: 'typescript', job_count: 10 },
        // Missing county prefix -- `groupByCounty` drops this row entirely,
        // it must not be folded into any county's total (Requirement 7.2).
        { location: '信義區', tech: 'typescript', job_count: 999 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionValueMaps(), { wrapper });

    await waitFor(() => {
      expect(result.current.techCountyValues.get('台北市')).toBe(10);
    });
    expect(result.current.techCountyValues.size).toBe(1);
    expect([...result.current.techCountyValues.values()]).not.toContain(999);
  });

  it('does not fall back to job-count data while no tech is selected (Requirement 4.3)', () => {
    useLocationMapStore.getState().setViewMode('tech');
    // `selectedTech` stays `null` (the neutral state) -- even if the tech
    // stats query somehow already has cached rows from a previous
    // selection, they must not leak into a misleading `techCountyValues`.
    useLocationTechStatsQuery.mockReturnValue({
      data: [{ location: '台北市大安區', tech: 'react', job_count: 999 }],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionValueMaps(), { wrapper });

    expect(result.current.techCountyValues.size).toBe(0);
  });

  it('returns an empty tech county map while the underlying query has no data yet', () => {
    useLocationMapStore.getState().setViewMode('tech');
    useLocationMapStore.getState().setSelectedTech('typescript');
    useLocationTechStatsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { result } = renderHook(() => useRegionValueMaps(), { wrapper });

    expect(result.current.techCountyValues.size).toBe(0);
  });
});
