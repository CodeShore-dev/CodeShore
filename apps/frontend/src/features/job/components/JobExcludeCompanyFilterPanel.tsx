import { useMemo, useState } from 'react';

import { useJobFilterStore } from '../jobFilterStore';
import { useCompanySearchQuery } from '../queries';

// Exclude-companies dropdown: search-as-you-type against /api/company, click
// a result to add it to the excluded list (rendered as removable chips).
// Mirrors JobLocationFilterPanel's section header/count-badge layout, but
// uses a closed-by-default suggestions dropdown instead of an always-open
// checklist, since companies aren't a small fixed set like locations.
export function JobExcludeCompanyFilterPanel() {
  const excludedCompanies = useJobFilterStore(s => s.excludedCompanies);
  const setExcludedCompanies = useJobFilterStore(s => s.setExcludedCompanies);

  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { data: companies = [], isFetching } = useCompanySearchQuery(search);

  const suggestions = useMemo(
    () => companies.filter(c => !excludedCompanies.includes(c.company_name)),
    [companies, excludedCompanies],
  );

  const addCompany = (name: string) => {
    if (!name || excludedCompanies.includes(name)) return;
    setExcludedCompanies([...excludedCompanies, name]);
    setSearch('');
    setShowSuggestions(false);
  };

  const removeCompany = (name: string) => {
    setExcludedCompanies(excludedCompanies.filter(c => c !== name));
  };

  return (
    <section>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
        <span>排除公司</span>
        {excludedCompanies.length > 0 && (
          <span className="rounded-full bg-[#ba1a1a] px-1.5 py-px text-[9px] leading-none text-white">
            {excludedCompanies.length}
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
          placeholder="搜尋要排除的公司..."
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
                  addCompany(c.company_name);
                }}
              >
                {c.company_name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {excludedCompanies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {excludedCompanies.map(name => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-md bg-[#ba1a1a] py-0.5 pr-1 pl-2 text-xs font-bold text-white"
            >
              <span>{name}</span>
              <button
                type="button"
                className="flex cursor-pointer items-center rounded transition-opacity hover:opacity-70"
                title={`移除排除公司：${name}`}
                onClick={() => removeCompany(name)}
              >
                <span className="material-symbols-outlined text-sm! leading-none">
                  close
                </span>
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
