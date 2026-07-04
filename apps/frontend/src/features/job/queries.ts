import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { fetchCompanies } from '../company/service';
import {
  DEFAULT_JOB_ORDERS,
  fetchJobPreferencedCount,
  fetchJobs,
  fetchLocationGroups,
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
  page: number;
  where: Record<string, unknown>;
  orders: string;
}

export function useJobsQuery(params: JobsQueryParams) {
  const { preference, page, where, orders } = params;
  return useQuery({
    queryKey: ['job', 'list', { preference, page, where, orders }],
    queryFn: async () => {
      const from = (page - 1) * JOB_PAGE_SIZE;
      const to = from + JOB_PAGE_SIZE - 1;
      const fullWhere = preference
        ? { preference: { eq: preference }, ...where }
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

// Location filter options (task 7.5), ported from useJobStore.getLocationGroups.
export function useLocationGroupsQuery() {
  return useQuery({
    queryKey: ['job', 'locationGroups'],
    queryFn: async () => (await fetchLocationGroups()).result,
  });
}

// Company name suggestions for the "exclude company" filter dropdown.
// Debounced type-ahead against /api/company (top matches only), so it scales
// to any number of companies without loading the whole table up front.
export function useCompanySearchQuery(search: string) {
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  return useQuery({
    queryKey: ['company', 'search', debouncedSearch],
    queryFn: async () => {
      const where = JSON.stringify({
        company_name: { ilike: `%${debouncedSearch}%` },
      });
      const res = await fetchCompanies({ from: 0, to: 9, where });
      return res.result;
    },
    enabled: debouncedSearch.length > 0,
  });
}
