import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCompanyFilterStore } from './companyFilterStore';
import { useCompanyTechFilterStore } from './companyTechFilterStore';
import { deriveCompanyWhere } from './deriveCompanyWhere';
import { fetchCompanies } from './service';

const PAGE_SIZE = 18;

// Company name suggestions for the company-name include/exclude filter
// dropdown (task 2.2). Debounced type-ahead against /api/company (top
// matches only), so it scales to any number of companies without loading
// the whole table up front. Relocated verbatim from the job feature so the
// company page no longer needs to borrow it from job/queries.ts.
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

export function useCompaniesQuery() {
  const companyFilters = useCompanyFilterStore(s => s.companyFilters);
  const page = useCompanyFilterStore(s => s.page);
  const selectedTags = useCompanyTechFilterStore(s => s.selectedTags);
  const excludedTags = useCompanyTechFilterStore(s => s.excludedTags);
  const techOperator = useCompanyTechFilterStore(s => s.keywordOperator);

  const whereClause = deriveCompanyWhere({
    companyFilters,
    selectedTags,
    excludedTags,
    techOperator,
  });
  const where =
    Object.keys(whereClause).length > 0
      ? JSON.stringify(whereClause)
      : undefined;

  const query = useQuery({
    queryKey: ['company', where ?? '', page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      return fetchCompanies({ from, to, where });
    },
  });

  const companies = query.data?.result ?? [];
  const totalCount = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return { companies, totalCount, totalPages, loading: query.isLoading };
}
