import { useEffect, useMemo, useRef, useState } from 'react';

import { OperatorToggle } from '../../../components/OperatorToggle';
import { SearchInput } from '../../../components/SearchInput';
import {
  useKeywordCategoriesQuery,
  useKeywordGroupsQuery,
} from '../../keyword/queries';
import { useCompanyFilterStore } from '../companyFilterStore';

export function CompanyKeywordFilter() {
  const selectedKeywordGroups = useCompanyFilterStore(
    s => s.selectedKeywordGroups,
  );
  const toggleKeywordGroup = useCompanyFilterStore(
    s => s.toggleKeywordGroup,
  );
  const operator = useCompanyFilterStore(s => s.keywordGroupOperator);
  const setOperator = useCompanyFilterStore(s => s.setOperator);

  const { data: keywordGroups = [] } = useKeywordGroupsQuery();
  const { tabs } = useKeywordCategoriesQuery();

  const [expanded, setExpanded] = useState(false);
  const [kgSearch, setKgSearch] = useState('');
  const [selectedKgCategory, setSelectedKgCategory] = useState('');

  const inited = useRef(false);
  useEffect(() => {
    if (inited.current || tabs.length === 0) return;
    inited.current = true;
    setSelectedKgCategory(tabs[0]?.value ?? '');
  }, [tabs]);

  const kgMappings = useMemo(() => {
    const q = kgSearch.trim().toLowerCase();
    if (q) {
      return keywordGroups.filter(g =>
        g.keyword_group.toLowerCase().includes(q),
      );
    }
    if (!selectedKgCategory) {
      const known = tabs.map(t => t.value).filter(Boolean);
      return keywordGroups.filter(g => !known.includes(g.category ?? ''));
    }
    return keywordGroups.filter(g => g.category === selectedKgCategory);
  }, [kgSearch, selectedKgCategory, keywordGroups, tabs]);

  return (
    <>
      <button
        type="button"
        className="bg-surface-container border-surface-container-highest text-on-surface-variant hover:text-on-surface flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="material-symbols-outlined text-sm">tag</span>
        技術篩選
        {selectedKeywordGroups.length > 0 && (
          <span className="bg-primary text-on-primary rounded-full px-1.5 py-0.5 text-sm">
            {selectedKeywordGroups.length}
          </span>
        )}
        <span className="material-symbols-outlined text-sm">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 w-full">
          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="mb-3">
              <SearchInput
                value={kgSearch}
                placeholder="搜尋技術..."
                onChange={setKgSearch}
              />
            </div>

            {selectedKeywordGroups.length > 1 && (
              <div className="mb-3">
                <OperatorToggle value={operator} onChange={setOperator} />
              </div>
            )}

            {!kgSearch.trim() && tabs.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {tabs.map(tab => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-sm font-bold transition-colors ${
                      selectedKgCategory === tab.value
                        ? 'bg-primary border-primary text-on-primary'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
                    }`}
                    onClick={() => setSelectedKgCategory(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-auto">
              {kgMappings.map(kg => (
                <button
                  key={kg.keyword_group}
                  type="button"
                  className={`cursor-pointer rounded px-2.5 py-1 text-sm font-bold transition-colors ${
                    selectedKeywordGroups.includes(kg.keyword_group)
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
                  }`}
                  onClick={() => toggleKeywordGroup(kg.keyword_group)}
                >
                  {kg.keyword_group}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
