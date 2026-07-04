import { useMemo, useState } from 'react';

import { useJobFilterStore } from '../jobFilterStore';
import { useCompanySearchQuery } from '../queries';
import { JobCompanyFilterChip } from './JobCompanyFilterChip';

// Unified company filter panel (Req 4): single search-as-you-type input
// against /api/company, click a result to add it as an "include" entry.
// Existing entries render as chips with their own toggle (include <->
// exclude, Req 4.3, 4.4) and remove (Req 4.7) controls. Replaces the
// previous exclude-only JobExcludeCompanyFilterPanel two-UI model.
export function JobCompanyFilterPanel() {
  const companyFilters = useJobFilterStore(s => s.companyFilters);
  const addCompanyFilter = useJobFilterStore(s => s.addCompanyFilter);
  const removeCompanyFilter = useJobFilterStore(s => s.removeCompanyFilter);
  const toggleCompanyFilterMode = useJobFilterStore(
    s => s.toggleCompanyFilterMode,
  );

  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: companies = [], isFetching } = useCompanySearchQuery(search);

  // Suggestions exclude any company already present in companyFilters
  // regardless of its current mode (Req 4.1) -- a company already tracked
  // as include or exclude shouldn't be offered again in the dropdown.
  const selectedNames = useMemo(
    () => new Set(companyFilters.map(entry => entry.name)),
    [companyFilters],
  );

  const suggestions = useMemo(
    () => companies.filter(c => !selectedNames.has(c.company_name)),
    [companies, selectedNames],
  );

  const selectCompany = (name: string) => {
    if (!name) return;
    // Defaults new entries to mode: 'include' (Req 4.2).
    addCompanyFilter(name);
    setSearch('');
    setShowSuggestions(false);
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
      <div className="relative mb-2">
        <span className="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
          search
        </span>
        <input
          value={search}
          type="text"
          placeholder="搜尋公司..."
          className="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border py-2 pr-8 pl-9 text-sm font-bold focus:outline-none"
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        {search && (
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer"
            onClick={() => setSearch('')}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
        {showSuggestions && search.trim() && (
          <ul className="border-surface-container-highest absolute top-full left-0 z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
            {isFetching && (
              <li className="text-on-surface-variant px-3 py-2 text-xs">
                搜尋中...
              </li>
            )}
            {!isFetching && suggestions.length === 0 && (
              <li className="text-on-surface-variant px-3 py-2 text-xs">
                沒有符合的公司
              </li>
            )}
            {suggestions.map(c => (
              <li
                key={c.company_id}
                className="hover:bg-primary-container hover:text-on-primary cursor-pointer px-3 py-2 text-sm font-bold"
                onMouseDown={e => {
                  e.preventDefault();
                  selectCompany(c.company_name);
                }}
              >
                {c.company_name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {companyFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {companyFilters.map(entry => (
            <JobCompanyFilterChip
              key={entry.name}
              entry={entry}
              onToggleMode={() => toggleCompanyFilterMode(entry.name)}
              onRemove={() => removeCompanyFilter(entry.name)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
