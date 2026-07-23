import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useLocationGroupsQuery } = vi.hoisted(() => ({
  useLocationGroupsQuery: vi.fn(),
}));

// `useRegionValueMaps` reuses `../queries`'s re-exported `useLocationGroupsQuery`
// (itself a thin re-export of `features/job/queries.ts`'s hook, per that
// file's own comment) rather than the job feature's `fetchLocationGroups`
// service call -- so this spec mocks at that same boundary, matching how
// `queries.spec.tsx` in this feature mocks `./service` for
// `useLocationTechStatsQuery`.
vi.mock('../queries', () => ({
  useLocationGroupsQuery,
}));

import { useRegionValueMaps } from './useRegionValueMaps';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
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
