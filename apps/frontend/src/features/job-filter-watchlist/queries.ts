import { useQuery } from '@tanstack/react-query';

import { fetchWatchlist } from './service';

// Fetches the current user's followed filter combinations, each enriched
// with totalCount/newCount/lastViewedAt (design.md 2.1-2.3, 3.1). Query key
// follows this repo's established root-segment + subresource convention
// (see `features/job/queries.ts`'s `['job', 'list', ...]`).
export function useWatchlistQuery() {
  return useQuery({
    queryKey: ['job-filter-watchlist', 'list'],
    queryFn: fetchWatchlist,
  });
}
