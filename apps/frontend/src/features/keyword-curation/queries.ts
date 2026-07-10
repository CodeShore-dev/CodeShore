import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchQueue } from './service';

// Unmapped keyword queue (requirement 1.1-1.3): GET /queue, ordered by count
// desc, filtered to eligible keywords server-side.
//
// The queue has no admin-supplied filter/search params (unlike
// `keyword/queries.ts`'s `useTechAdminQuery`, which debounces a search box
// into its queryKey) -- there is nothing to key on besides the fixed
// ['keyword-curation', 'queue'] tuple, so "queryKey 含 stale 防抖" from the
// task text is interpreted here as a caching policy rather than a literal
// per-keystroke debounce: `staleTime` keeps the list from refetching on
// every remount while the admin works through a session (the queue is
// explicitly invalidated by `useResumeSessionMutation`, task 5.3, whenever a
// keyword actually leaves it), and `refetchOnWindowFocus` is disabled so
// switching tabs mid-session doesn't reshuffle/refetch the list out from
// under the admin's current position.
//
// `placeholderData: keepPreviousData` (TanStack Query v5's replacement for
// the old `keepPreviousData: true` option, per this repo's installed
// `@tanstack/react-query@^5.0.0`) keeps the previously-fetched list visible
// during a refetch instead of transiently going `undefined`, mirroring
// `ai-suggestion/queries.ts`'s `useSuggestionsQuery`.
export function useKeywordQueueQuery() {
  return useQuery({
    queryKey: ['keyword-curation', 'queue'],
    queryFn: () => fetchQueue(),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
