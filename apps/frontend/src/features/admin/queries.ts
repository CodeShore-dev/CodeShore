import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAdminStore } from './adminStore';
import {
  AnomalyJob,
  fetchCrawlStats,
  fetchEmptyDescriptionJobs,
  fetchLocationAnomalies,
  fetchSalaryAnomalies,
  fetchUpdateDateCounts,
} from './service';

export const ADMIN_PAGE_SIZE = 20;
export const UNMAPPED_GROUP_THRESHOLD = 10;
export const BELOW_KEY = '__below__';

export interface LocationGroupRow {
  key: string;
  location: string;
  count: number;
  jobs: AnomalyJob[];
}

// Groups unmapped-location jobs by location, keeping locations with >= threshold
// jobs as their own rows and folding the long tail into a single "其他" bucket
// (pure port of useAdminStore.locationGroupRows).
export function groupUnmappedJobs(jobs: AnomalyJob[]): LocationGroupRow[] {
  const map = new Map<string, AnomalyJob[]>();
  for (const j of jobs) {
    const loc = j.location ?? '';
    if (!map.has(loc)) map.set(loc, []);
    map.get(loc)!.push(j);
  }
  const groups = [...map.entries()]
    .map(([location, list]) => ({ location, jobs: list, count: list.length }))
    .sort((a, b) => b.count - a.count);

  const rows: LocationGroupRow[] = groups
    .filter(g => g.count >= UNMAPPED_GROUP_THRESHOLD)
    .map(g => ({
      key: g.location,
      location: g.location || '（空字串）',
      count: g.count,
      jobs: g.jobs,
    }));

  const small = groups.filter(g => g.count < UNMAPPED_GROUP_THRESHOLD);
  if (small.length) {
    const tail = small.flatMap(g => g.jobs);
    rows.push({
      key: BELOW_KEY,
      location: `其他（每個地點 < ${UNMAPPED_GROUP_THRESHOLD}，共 ${small.length} 個地點）`,
      count: tail.length,
      jobs: tail,
    });
  }
  return rows;
}

export function useCrawlStatsQuery() {
  const statsDays = useAdminStore(s => s.statsDays);
  return useQuery({
    queryKey: ['admin', 'stats', statsDays],
    queryFn: () => fetchCrawlStats(statsDays),
  });
}

export function useSalaryAnomaliesQuery() {
  const { monthCeil, yearCeil } = useAdminStore(s => s.salaryThreshold);
  const page = useAdminStore(s => s.salaryPage);
  const query = useQuery({
    queryKey: ['admin', 'salary', monthCeil, yearCeil, page],
    queryFn: () => {
      const from = (page - 1) * ADMIN_PAGE_SIZE;
      return fetchSalaryAnomalies({
        from,
        to: from + ADMIN_PAGE_SIZE - 1,
        monthCeil,
        yearCeil,
      });
    },
  });
  return {
    items: query.data?.result ?? [],
    count: query.data?.count ?? 0,
    loading: query.isLoading,
  };
}

export function useEmptyDescriptionQuery() {
  const page = useAdminStore(s => s.emptyPage);
  const query = useQuery({
    queryKey: ['admin', 'empty', page],
    queryFn: () => {
      const from = (page - 1) * ADMIN_PAGE_SIZE;
      return fetchEmptyDescriptionJobs({ from, to: from + ADMIN_PAGE_SIZE - 1 });
    },
  });
  return {
    items: query.data?.result ?? [],
    count: query.data?.count ?? 0,
    loading: query.isLoading,
  };
}

export function useUnmappedLocationsQuery() {
  const maxLen = useAdminStore(s => s.locationMaxLen);
  const query = useQuery({
    queryKey: ['admin', 'unmapped', maxLen],
    queryFn: () =>
      fetchLocationAnomalies({ from: 0, to: -1, type: 'unmapped', maxLen }),
  });
  const groups = useMemo(
    () => groupUnmappedJobs(query.data?.result ?? []),
    [query.data],
  );
  return { groups, loading: query.isLoading };
}

export function useUpdateDateCountsQuery() {
  const query = useQuery({
    queryKey: ['admin', 'updateDates'],
    queryFn: () => fetchUpdateDateCounts(),
  });
  return { dates: query.data ?? [], loading: query.isLoading };
}
