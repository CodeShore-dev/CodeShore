import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCompanyFilterStore } from './companyFilterStore';
import { fetchCompanies } from './service';

const PAGE_SIZE = 18;

// Builds the company list `where` clause (task 6.1), mirroring the Vue store:
// company_name ilike search + techs contains/overlaps the selection.
export function buildCompanyWhere(
  search: string,
  groups: string[],
  operator: 'and' | 'or',
): string | undefined {
  const conditions: Record<string, unknown> = {};
  if (search.trim()) {
    conditions.company_name = { ilike: `%${search.trim()}%` };
  }
  if (groups.length > 0) {
    const op = operator === 'or' ? 'ov' : 'cs';
    conditions.techs = { [op]: `{${groups.join(',')}}` };
  }
  return Object.keys(conditions).length > 0
    ? JSON.stringify(conditions)
    : undefined;
}

export function useCompaniesQuery() {
  const search = useCompanyFilterStore(s => s.search);
  const groups = useCompanyFilterStore(s => s.selectedTechs);
  const operator = useCompanyFilterStore(s => s.techOperator);
  const page = useCompanyFilterStore(s => s.page);

  const debouncedSearch = useDebouncedValue(search, 400);
  const where = buildCompanyWhere(debouncedSearch, groups, operator);

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
