import { useQuery } from '@tanstack/react-query';

import {
  fetchLocationSalaryStats,
  fetchLocationTechStats,
  LocationSalaryStatsQueryHookOptions,
  LocationTechStatsQueryHookOptions,
} from './service';

// Reused as-is (not redeclared): `features/job/queries.ts`'s
// `useLocationGroupsQuery` already fetches the full, unfiltered "all
// locations, open job counts" dataset via `GET /api/job/location` under its
// own stable `['job', 'locationGroups']` queryKey -- exactly the "job count"
// view this feature's county-level choropleth needs by default (Requirement
// 2, design.md's file-structure-plan note "視情況重用既有 /job/location").
// Declaring a second, parallel hook here would only duplicate that cache
// entry under a different key with no behavioral difference, and risk the
// two falling out of sync after future edits to either feature. So
// location-map re-exports the job feature's hook rather than wrapping or
// redeclaring it; `useLocationTechStatsQuery` below is the only query this
// feature owns, since the "technology" view (Requirement 4) has no existing
// equivalent to reuse.
export { useLocationGroupsQuery } from '../job/queries';

// `useLocationTechStatsQuery(where)` backs both of this feature's
// `mv_location_tech`-scoped reads (design.md "MvLocationTechService（Service
// Contract）" 呼叫端使用方式):
//   - technology view map coloring: where = { tech: { eq: selectedTech } },
//     every location, default ordering (job_count:desc), full result set.
//   - region detail panel Top-10 tech ranking: where = { location: { eq:
//     regionId } }, from/to overridden to page 0-9.
// `where` (and any pagination/order overrides) is included in the queryKey
// so these two shapes -- one tech across every location vs. one location
// across every tech -- are cached and refetched independently by TanStack
// Query, instead of colliding on a single shared cache entry.
export function useLocationTechStatsQuery(
  where: Record<string, unknown>,
  options: LocationTechStatsQueryHookOptions = {},
) {
  const { from = 0, to = -1, orders = 'job_count:desc', enabled = true } = options;
  return useQuery({
    queryKey: ['job', 'locationTech', { where, from, to, orders }],
    queryFn: async () =>
      (await fetchLocationTechStats(where, { from, to, orders })).result,
    enabled,
  });
}

// `useLocationSalaryStatsQuery(where)` mirrors `useLocationTechStatsQuery`
// exactly, backing this feature's `mv_location_salary`-scoped reads
// (design.md "API 端點（GET /api/job/location-salary）" 呼叫端使用方式):
//   - district-level popup: where = { location: { eq: regionId } } (至多 2
//     列：月薪／年薪各一)
//   - county-level popup: from/to overridden to fetch the full result set,
//     aggregated client-side via `groupByCounty` (same "全量抓取 +
//     groupByCounty" strategy as `useRegionValueMaps.countyValues`)
// `where` (and any pagination/order overrides) is included in the queryKey
// so distinct filters are cached and refetched independently by TanStack
// Query.
export function useLocationSalaryStatsQuery(
  where: Record<string, unknown>,
  options: LocationSalaryStatsQueryHookOptions = {},
) {
  const { from = 0, to = -1, orders = 'job_count:desc', enabled = true } = options;
  return useQuery({
    queryKey: ['job', 'locationSalary', { where, from, to, orders }],
    queryFn: async () =>
      (await fetchLocationSalaryStats(where, { from, to, orders })).result,
    enabled,
  });
}
