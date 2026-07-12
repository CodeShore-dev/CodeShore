import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { JobFilterSnapshot } from '@codeshore/shared-utils';

import {
  followFilter,
  markWatchlistViewed,
  unfollowFilter,
} from './service';

// Follows the currently applied filter combination (design.md 1.1, 1.3,
// 5.2). Non-optimistic, invalidate-based refresh on success -- matching
// `useClearPreferencesMutation`'s style (`features/job/mutations.ts`), not
// `usePreferenceMutation`'s optimistic-update style, per design.md's
// Components section ("refresh the followed-list query on success"). A 409
// WATCHLIST_LIMIT_REACHED rejection (see `service.ts`'s
// `isWatchlistLimitReachedError`) surfaces as `mutation.error` like any other
// failure and intentionally does NOT invalidate the list, since no
// subscription was created.
export function useFollowFilterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      filterSnapshot,
      filterWhere,
      label,
    }: {
      filterSnapshot: JobFilterSnapshot;
      filterWhere: Record<string, unknown>;
      label: string;
    }) => followFilter(filterSnapshot, filterWhere, label),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['job-filter-watchlist', 'list'],
      });
    },
  });
}

// Unfollows a filter combination (design.md 4.1), refreshing the followed
// list on success.
export function useUnfollowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unfollowFilter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['job-filter-watchlist', 'list'],
      });
    },
  });
}

// Marks a followed filter combination as just viewed (design.md 3.2),
// refreshing the followed list on success so the recomputed
// newCount/lastViewedAt show up.
export function useMarkViewedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markWatchlistViewed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['job-filter-watchlist', 'list'],
      });
    },
  });
}
