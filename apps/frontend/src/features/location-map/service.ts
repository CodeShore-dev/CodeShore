import {
  ListResponse,
  SupabaseView,
} from '@codeshore/data-types';

import { httpClient } from '../../httpClient';

// Optional pagination/ordering overrides for `fetchLocationTechStats`
// (design.md "API 端點（GET /api/job/location-tech）"). `where` is the one
// required argument -- everything else defaults to "fetch the full result
// set, highest job_count first" (task 5.1's map-coloring use case), and gets
// overridden by the region-detail-panel caller (design.md's
// `fetchAll({ ..., from: 0, to: 9 })` Top-10 example).
export interface LocationTechStatsQueryOptions {
  from?: number;
  to?: number;
  orders?: string;
}

// TanStack Query's `enabled` gate for `useLocationTechStatsQuery` -- kept
// separate from `LocationTechStatsQueryOptions` since it is a query-hook
// concern, not an HTTP param `fetchLocationTechStats` itself understands.
export interface LocationTechStatsQueryHookOptions
  extends LocationTechStatsQueryOptions {
  enabled?: boolean;
}

// Mirrors `apps/backend/src/features/job/service.ts`'s
// `getLocationTechStats(query: QueryDto)` -> `MvLocationTechService.fetchAll`,
// which passes `where`/`orders`/`from`/`to` through as-is to `mv_location_tech`
// (already committed backend contract, GET /api/job/location-tech). Follows
// the exact `httpClient`/`ListResponse<T>` pattern of
// `features/job/service.ts`'s `fetchLocationGroups`, except `where` is a
// per-call filter (not a fixed query) so it's JSON-stringified here the same
// way `features/job/queries.ts`'s `useJobsQuery` stringifies its `where`
// before it reaches the wire (`QueryDto.where` is transformed from a JSON
// string on the backend).
export const fetchLocationTechStats = async (
  where: Record<string, unknown>,
  options: LocationTechStatsQueryOptions = {},
) => {
  const { from = 0, to = -1, orders = 'job_count:desc' } = options;
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvLocationTech>
  >('/api/job/location-tech', {
    params: {
      from,
      to,
      orders,
      where: JSON.stringify(where),
    },
  });
  return res.data;
};
