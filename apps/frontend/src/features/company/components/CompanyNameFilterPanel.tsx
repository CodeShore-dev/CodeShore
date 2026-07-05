import { useMemo, useState } from 'react';

import { CompanyFilterPanel } from '../../../components/CompanyFilterPanel';
import { useCompanyFilterStore } from '../companyFilterStore';
import { useCompanySearchQuery } from '../queries';

// Thin wrapper (task 2.2) connecting companyFilterStore (task 2.1) and the
// relocated useCompanySearchQuery (this task) to the shared, presentational
// CompanyFilterPanel (task 1.4). Owns only the local search text state and
// the suggestions-exclude-selected filtering logic; all rendering and
// interaction behavior lives in the shared component so this mirrors the
// job page's equivalent (Req 1.1-1.4, 1.7, 1.8).
export function CompanyNameFilterPanel() {
  const companyFilters = useCompanyFilterStore(s => s.companyFilters);
  const addCompanyFilter = useCompanyFilterStore(s => s.addCompanyFilter);
  const removeCompanyFilter = useCompanyFilterStore(
    s => s.removeCompanyFilter,
  );
  const toggleCompanyFilterMode = useCompanyFilterStore(
    s => s.toggleCompanyFilterMode,
  );

  const [search, setSearch] = useState('');

  const { data: companies = [], isFetching } = useCompanySearchQuery(search);

  // Suggestions exclude any company already present in companyFilters
  // regardless of its current mode (Req 1.8).
  const selectedNames = useMemo(
    () => new Set(companyFilters.map(entry => entry.name)),
    [companyFilters],
  );

  const suggestions = useMemo(
    () => companies.filter(c => !selectedNames.has(c.company_name)),
    [companies, selectedNames],
  );

  const handleSelect = (name: string) => {
    // Defaults new entries to mode: 'include' (Req 1.2).
    addCompanyFilter(name);
    setSearch('');
  };

  return (
    <CompanyFilterPanel
      entries={companyFilters}
      search={search}
      onSearchChange={setSearch}
      suggestions={suggestions}
      isFetching={isFetching}
      onSelect={handleSelect}
      onToggleMode={toggleCompanyFilterMode}
      onRemove={removeCompanyFilter}
    />
  );
}
