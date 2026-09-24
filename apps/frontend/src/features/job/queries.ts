import { useQuery } from '@tanstack/react-query';

import {
  DEFAULT_JOB_ORDERS,
  fetchJobPreferencedCount,
  fetchJobs,
  fetchLocationGroups,
  fetchPreferenceReasons,
} from './service';

export const JOB_PAGE_SIZE = 10;

// preference_updated_at ordering only applies inside the like/dislike lists
// when sorting by recency (parity with useJobStore.listOrders).
export function jobListOrders(
  listViewPreference: 'like' | 'dislike' | null,
  sort: 'salary' | 'recent',
): string {
  return listViewPreference && sort === 'recent'
    ? 'preference_updated_at:desc'
    : DEFAULT_JOB_ORDERS;
}

export interface JobsQueryParams {
  preference: 'like' | 'dislike' | null;
  // Only applied when `preference` is set; ignored on the 總數 tab.
  preferenceReason?: string | null;
  page: number;
  where: Record<string, unknown>;
  orders: string;
}

export function useJobsQuery(params: JobsQueryParams) {
  const { preference, page, where, orders } = params;
  const preferenceReason = params.preferenceReason ?? null;
  return useQuery({
    queryKey: [
      'job',
      'list',
      { preference, preferenceReason, page, where, orders },
    ],
    queryFn: async () => {
      const from = (page - 1) * JOB_PAGE_SIZE;
      const to = from + JOB_PAGE_SIZE - 1;
      // The reason filter is merged with every other where condition so it
      // combines with the existing filters (req 7.2, 7.4).
      const fullWhere = preference
        ? {
            preference: { eq: preference },
            ...(preferenceReason
              ? { preference_reason: { eq: preferenceReason } }
              : {}),
            ...where,
          }
        : { preference: { is: null }, ...where };
      return fetchJobs(
        { from, to, where: JSON.stringify(fullWhere) },
        orders,
      );
    },
  });
}

export function usePreferencedCountQuery() {
  return useQuery({
    queryKey: ['job', 'preferencedCount'],
    queryFn: fetchJobPreferencedCount,
  });
}

// Reason (sub-category) counts for a like/dislike bucket; invalidated by
// every preference mutation via the ['job', 'preferenceReasons'] prefix.
export function usePreferenceReasonsQuery(
  preference: 'like' | 'dislike',
  enabled = true,
) {
  return useQuery({
    queryKey: ['job', 'preferenceReasons', preference],
    queryFn: () => fetchPreferenceReasons(preference),
    enabled,
  });
}

// Location filter options (task 7.5), ported from useJobStore.getLocationGroups.
export function useLocationGroupsQuery() {
  return useQuery({
    queryKey: ['job', 'locationGroups'],
    queryFn: async () => (await fetchLocationGroups()).result,
  });
}
