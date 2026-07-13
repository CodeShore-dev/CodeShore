import { useQuery } from '@tanstack/react-query';

import { fetchWatchlist } from './service';

// Fetches the current user's followed filter combinations, each enriched
// with totalCount/newCount/lastViewedAt (design.md 2.1-2.3, 3.1). Query key
// follows this repo's established root-segment + subresource convention
// (see `features/job/queries.ts`'s `['job', 'list', ...]`).
//
// `enabled` lets a caller mounted for guests too (e.g. JobFilterFollowButton,
// which renders on every /jobs visit) skip firing this request until the
// user is actually authenticated, instead of letting every guest page load
// trigger a doomed 401 call.
export function useWatchlistQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['job-filter-watchlist', 'list'],
    queryFn: fetchWatchlist,
    enabled: options?.enabled,
  });
}
