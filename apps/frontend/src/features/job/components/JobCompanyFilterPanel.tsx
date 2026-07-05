import { useMemo, useState } from 'react';

import { CompanyFilterPanel } from '../../../components/CompanyFilterPanel';
import { useCompanySearchQuery } from '../../company/queries';
import { useJobFilterStore } from '../jobFilterStore';

// Thin wrapper (task 7.2) connecting jobFilterStore's company filter state
// and the relocated useCompanySearchQuery to the shared, presentational
// CompanyFilterPanel (task 1.4). Mirrors CompanyNameFilterPanel.tsx (task
// 2.2); this wrapper additionally keeps its own "公司" label and
// active-filter-count badge chrome, which the shared component deliberately
// does not include (task 1.4's design).
export function JobCompanyFilterPanel() {
  const companyFilters = useJobFilterStore(s => s.companyFilters);
  const addCompanyFilter = useJobFilterStore(s => s.addCompanyFilter);
  const removeCompanyFilter = useJobFilterStore(s => s.removeCompanyFilter);
  const toggleCompanyFilterMode = useJobFilterStore(
    s => s.toggleCompanyFilterMode,
  );

  const [search, setSearch] = useState('');

  const { data: companies = [], isFetching } = useCompanySearchQuery(search);

  // Suggestions exclude any company already present in companyFilters
  // regardless of its current mode (Req 1.8) -- a company already tracked
  // as include or exclude shouldn't be offered again in the dropdown.
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
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
        <span>公司</span>
        {companyFilters.length > 0 && (
          <span className="shrink-0 rounded-full bg-[#ba1a1a] px-1.5 py-px text-[9px] leading-none text-white tabular-nums">
            {companyFilters.length}
          </span>
        )}
      </div>
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
    </section>
  );
}
