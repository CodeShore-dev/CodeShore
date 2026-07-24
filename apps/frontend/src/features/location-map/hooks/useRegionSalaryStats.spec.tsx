import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `useRegionSalaryStats` reads `../queries`'s `useLocationSalaryStatsQuery`
// exactly the way `useRegionValueMaps.spec.tsx` mocks `useLocationGroupsQuery`/
// `useLocationTechStatsQuery` at the same `../queries` boundary -- mirroring
// that convention rather than mocking `../service` directly.
const { useLocationSalaryStatsQuery } = vi.hoisted(() => ({
  useLocationSalaryStatsQuery: vi.fn(),
}));

vi.mock('../queries', () => ({
  useLocationSalaryStatsQuery,
}));

import { useRegionSalaryStats } from './useRegionSalaryStats';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRegionSalaryStats (regionId === null)', () => {
  it('returns the zero state for both salary types without querying a specific region', () => {
    useLocationSalaryStatsQuery.mockReturnValue({ data: [], isLoading: false, isError: false });

    const { result } = renderHook(() => useRegionSalaryStats(null, 'district'), { wrapper });

    expect(result.current).toEqual({
      month: { jobCount: 0, avgSalary: null },
      year: { jobCount: 0, avgSalary: null },
    });
  });
});

describe('useRegionSalaryStats (district tier)', () => {
  it('reads the single month/year row for the given location directly', async () => {
    useLocationSalaryStatsQuery.mockReturnValue({
      data: [
        { location: '台北市大安區', salary_type: 'month', job_count: 20, avg_salary: 60000 },
        { location: '台北市大安區', salary_type: 'year', job_count: 5, avg_salary: 800000 },
        // Another district's rows must not leak into 台北市大安區's stats.
        { location: '新北市板橋區', salary_type: 'month', job_count: 999, avg_salary: 1 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(
      () => useRegionSalaryStats('台北市大安區', 'district'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.month).toEqual({ jobCount: 20, avgSalary: 60000 });
    });
    expect(result.current.year).toEqual({ jobCount: 5, avgSalary: 800000 });
  });

  it('returns the zero state for a salary type with no row for this district (Requirement 5.3)', async () => {
    useLocationSalaryStatsQuery.mockReturnValue({
      data: [
        // Only a month row exists for this district -- no year-salary jobs.
        { location: '新北市板橋區', salary_type: 'month', job_count: 15, avg_salary: 55000 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(
      () => useRegionSalaryStats('新北市板橋區', 'district'),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.month).toEqual({ jobCount: 15, avgSalary: 55000 });
    });
    expect(result.current.year).toEqual({ jobCount: 0, avgSalary: null });
  });
});

describe('useRegionSalaryStats (county tier)', () => {
  it('computes a job-count-weighted average, not a naive unweighted average, across townships', async () => {
    // Naive (unweighted) average of the two avg_salary values would be
    // (100000 + 50000) / 2 = 75000 -- a DIFFERENT, wrong answer. The correct
    // job-count-weighted average is:
    //   (100000 * 10 + 50000 * 90) / (10 + 90)
    //   = (1,000,000 + 4,500,000) / 100
    //   = 55000
    useLocationSalaryStatsQuery.mockReturnValue({
      data: [
        { location: '台中市西區', salary_type: 'month', job_count: 10, avg_salary: 100000 },
        { location: '台中市北區', salary_type: 'month', job_count: 90, avg_salary: 50000 },
        // A different county's rows must not leak into 台中市's aggregation.
        { location: '台北市大安區', salary_type: 'month', job_count: 1000, avg_salary: 1 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionSalaryStats('台中市', 'county'), { wrapper });

    await waitFor(() => {
      expect(result.current.month.jobCount).toBe(100);
    });
    expect(result.current.month.avgSalary).toBe(55000);
    expect(result.current.month.avgSalary).not.toBe(75000);
  });

  it('returns the zero state for a salary type entirely absent across the whole county (Requirement 5.3)', async () => {
    useLocationSalaryStatsQuery.mockReturnValue({
      data: [
        // 高雄市 only has month-salary jobs across every township -- zero
        // year-salary jobs anywhere in the county.
        { location: '高雄市三民區', salary_type: 'month', job_count: 12, avg_salary: 48000 },
        { location: '高雄市苓雅區', salary_type: 'month', job_count: 8, avg_salary: 52000 },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionSalaryStats('高雄市', 'county'), { wrapper });

    await waitFor(() => {
      expect(result.current.month.jobCount).toBe(20);
    });
    expect(result.current.year).toEqual({ jobCount: 0, avgSalary: null });
  });

  it('excludes a row with a null avg_salary from the weighted-average calculation but still counts its job_count in the total (data anomaly)', async () => {
    useLocationSalaryStatsQuery.mockReturnValue({
      data: [
        { location: '台南市東區', salary_type: 'month', job_count: 10, avg_salary: 60000 },
        // Anomalous row: job_count > 0 but avg_salary is null. Its job_count
        // must still count toward the total, but it must not contribute to
        // the weighted-average numerator/denominator.
        { location: '台南市北區', salary_type: 'month', job_count: 5, avg_salary: null },
      ],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useRegionSalaryStats('台南市', 'county'), { wrapper });

    await waitFor(() => {
      // Total job_count includes the anomalous row's 5.
      expect(result.current.month.jobCount).toBe(15);
    });
    // Weighted average computed only from the one valid row: 60000.
    expect(result.current.month.avgSalary).toBe(60000);
  });
});
