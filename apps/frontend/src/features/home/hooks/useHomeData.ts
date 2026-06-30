import { useQuery } from '@tanstack/react-query';

import { formatNumber } from '../../../utils/format';
import {
  fetchJobCount,
  fetchMvSalaryTypeMedianRatio,
  fetchMvSalaryRangeMultiplier,
} from '../service';

type Benchmark = { median: number; high: number; top: number };

// Home server-state via TanStack Query (task 5.1), replacing the Pinia store's
// fetch + derived getters. Components call this directly; the shared query
// cache dedupes the three requests.
export function useHomeData() {
  const medianRatio = useQuery({
    queryKey: ['home', 'salaryTypeMedianRatio'],
    queryFn: async () => (await fetchMvSalaryTypeMedianRatio()).result,
  });
  const rangeMultiplier = useQuery({
    queryKey: ['home', 'salaryRangeMultiplier'],
    queryFn: async () => (await fetchMvSalaryRangeMultiplier()).result,
  });
  const jobCount = useQuery({
    queryKey: ['home', 'jobCount'],
    queryFn: async () => (await fetchJobCount())[0],
  });

  const loading =
    medianRatio.isLoading ||
    rangeMultiplier.isLoading ||
    jobCount.isLoading;

  const median = medianRatio.data ?? [];
  const yearSalary = median.find(s => s.salary_type === 'year');
  const monthSalary = median.find(s => s.salary_type === 'month');
  const salaryBenchmarks: Record<'year' | 'month', Benchmark> = {
    month: {
      median: monthSalary?.median_mark ?? 0,
      high: monthSalary?.high_mark ?? 0,
      top: monthSalary?.top_mark ?? 0,
    },
    year: {
      median: yearSalary?.median_mark ?? 0,
      high: yearSalary?.high_mark ?? 0,
      top: yearSalary?.top_mark ?? 0,
    },
  };

  const multiplier = rangeMultiplier.data ?? [];
  const salaryRangeMultipliers: Record<'year' | 'month', number> = {
    year: multiplier.find(r => r.salary_type === 'year')?.ratio ?? 0,
    month: multiplier.find(r => r.salary_type === 'month')?.ratio ?? 0,
  };

  const jc = jobCount.data ?? {
    jobs: 0,
    open_jobs: 0,
    month_salary_type_jobs: 0,
    year_salary_type_jobs: 0,
  };
  const jobCountText = {
    total: formatNumber(jc.jobs),
    open: formatNumber(jc.open_jobs),
    month: formatNumber(jc.month_salary_type_jobs),
    year: formatNumber(jc.year_salary_type_jobs),
  };

  return {
    loading,
    salaryBenchmarks,
    salaryRangeMultipliers,
    jobCountText,
    // Raw open-jobs count: the job page derives its "總數" tab from
    // open_jobs − liked − disliked (task 7.5).
    openJobs: jc.open_jobs,
  };
}
