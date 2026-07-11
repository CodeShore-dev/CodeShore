import { useState } from 'react';

import { TechFilterPanel } from '../../../components/TechFilterPanel';
import { useKeywordCatalogView } from '../../keyword/useKeywordCatalogView';
import { useCompanyTechFilterStore } from '../companyTechFilterStore';

// Thin wrapper (task 3.2) connecting the company page's independent tech
// selection store (task 3.1) and the parameterized catalog view hook
// (task 1.2) to the shared TechFilterPanel presentation (task 1.3). Mirrors
// the shape JobTechFilterPanel will move to in task 7.2; only the store
// differs, so selections here never affect the job page's filter state.
//
// Unlike the job page (where this panel lives in an always-visible sidebar),
// on the company page it sits inline above the results, so it's collapsible
// to avoid pushing the company grid down. Starts expanded only if a
// selection already exists.
export function CompanyTechFilterPanel() {
  const view = useKeywordCatalogView(useCompanyTechFilterStore);
  const activeCount = view.selectedTags.length + view.excludedTags.length;
  const [expanded, setExpanded] = useState(activeCount > 0);

  return (
    <section>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="text-sm font-bold text-[#434653]">
          技術篩選
          {activeCount > 0 && (
            <span className="ml-1.5 rounded-full bg-[#003d92]/10 px-1.5 py-0.5 text-xs text-[#003d92]">
              {activeCount}
            </span>
          )}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant text-lg!">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {expanded && (
        <div className="mt-3">
          <TechFilterPanel {...view} searchPlaceholder="搜尋技術..." />
        </div>
      )}
    </section>
  );
}
