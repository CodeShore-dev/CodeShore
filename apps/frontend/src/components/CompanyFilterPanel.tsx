import { useState } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import {
  CompanyFilterChip,
  type CompanyFilterEntry,
} from './CompanyFilterChip';

export interface CompanyFilterPanelProps {
  entries: CompanyFilterEntry[];
  search: string;
  onSearchChange: (value: string) => void;
  suggestions: SupabaseView.MvCompany[];
  isFetching: boolean;
  onSelect: (name: string) => void;
  onToggleMode: (name: string) => void;
  onRemove: (name: string) => void;
  searchPlaceholder?: string;
}

// Shared company filter panel presentation (task 1.4): search-as-you-type
// input against a caller-supplied suggestions list, focus/blur-driven
// dropdown (150ms close delay on blur so a suggestion mousedown still
// registers before the dropdown hides), and existing entries rendered below
// as chips via CompanyFilterChip. Extracted from JobCompanyFilterPanel to be
// fully props-driven: suggestions/isFetching are supplied by the caller
// (already filtered to exclude selected entries, Req 1.8) instead of this
// component calling useCompanySearchQuery itself, so it can be reused by
// both the job and company pages (task 7.2, 2.2).
export function CompanyFilterPanel({
  entries,
  search,
  onSearchChange,
  suggestions,
  isFetching,
  onSelect,
  onToggleMode,
  onRemove,
  searchPlaceholder = '搜尋公司...',
}: CompanyFilterPanelProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const selectCompany = (name: string) => {
    if (!name) return;
    onSelect(name);
    setShowSuggestions(false);
  };

  return (
    <section>
      <div className="relative mb-2">
        <span className="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
          search
        </span>
        <input
          value={search}
          type="text"
          placeholder={searchPlaceholder}
          className="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border py-2 pr-8 pl-9 text-sm font-bold focus:outline-none"
          onChange={e => onSearchChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        {search && (
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer"
            onClick={() => onSearchChange('')}
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
                  selectCompany(c.company_name ?? '');
                }}
              >
                {c.company_name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(entry => (
            <CompanyFilterChip
              key={entry.name}
              entry={entry}
              onToggleMode={() => onToggleMode(entry.name)}
              onRemove={() => onRemove(entry.name)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
