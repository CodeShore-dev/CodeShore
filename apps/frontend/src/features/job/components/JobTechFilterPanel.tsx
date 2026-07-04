import { type MouseEvent, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { SupabaseView } from '@codeshore/data-types';

import { OperatorToggle } from '../../../components/OperatorToggle';
import { TechIcon } from '../../../components/TechIcon';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useKeywordCatalogView } from '../../keyword/useKeywordCatalogView';

const TABS_COLLAPSED_LIMIT = 4;

const tagLabel = (tag: string) => TAG_LABEL_MAP[tag] ?? tag;

// Tech filter panel: search, category tabs, AND/OR toggle, tech list
// (task 7.5), ported from JobKeywordFilterPanel.vue. Selection lives in the
// shared keyword filter store; derived views come from useKeywordCatalogView.
export function JobTechFilterPanel() {
  const {
    techs,
    visibleTabs,
    selectedTab,
    setSelectedTab,
    keywordSearch,
    setKeywordSearch,
    categoriesWithSelections,
    filteredTechView,
  } = useKeywordCatalogView();

  // Lookup from tech id to its full catalog record (task 3.1, Req 6.1-6.3),
  // so parent references can be rendered by their resolved label instead of
  // the raw id. Built once per techs change: O(n) to build, O(1) to query.
  const techByTech = useMemo(() => {
    const map = new Map<string, SupabaseView.MvTech>();
    for (const tech of techs) {
      map.set(tech.tech, tech);
    }
    return map;
  }, [techs]);

  const selectedTags = useKeywordFilterStore(s => s.selectedTags);
  const excludedTags = useKeywordFilterStore(s => s.excludedTags);
  const keywordOperator = useKeywordFilterStore(s => s.keywordOperator);
  const setOperator = useKeywordFilterStore(s => s.setOperator);
  const toggleLanguage = useKeywordFilterStore(s => s.toggleLanguage);

  const [tabsExpanded, setTabsExpanded] = useState(false);
  const [tabTooltip, setTabTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const showTabTooltip = (e: MouseEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTabTooltip({ text, x: rect.left + rect.width / 2, y: rect.top });
  };

  const shownTabs = tabsExpanded
    ? visibleTabs
    : visibleTabs.slice(0, TABS_COLLAPSED_LIMIT);

  return (
    <section>
      <div className="relative mb-3">
        <span className="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
          search
        </span>
        <input
          value={keywordSearch}
          type="text"
          placeholder="搜尋技能..."
          className="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border py-2 pr-8 pl-9 text-sm font-bold focus:outline-none"
          onChange={e => setKeywordSearch(e.target.value)}
        />
        {keywordSearch && (
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer"
            onClick={() => setKeywordSearch('')}
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {shownTabs.map(item => (
          <div
            key={item.value}
            className="relative"
            onMouseEnter={e => showTabTooltip(e, item.tooltip)}
            onMouseLeave={() => setTabTooltip(null)}
          >
            <button
              type="button"
              className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                selectedTab === item.value
                  ? 'bg-primary border-primary text-on-primary'
                  : categoriesWithSelections.has(item.value)
                    ? 'border-primary text-primary hover:bg-primary/5'
                    : 'border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
              }`}
              onClick={() => setSelectedTab(item.value)}
            >
              {item.label}
              {categoriesWithSelections.has(item.value) && (
                <span className="inline-block size-1.5 rounded-full bg-red-400 align-top" />
              )}
            </button>
          </div>
        ))}

        {visibleTabs.length > TABS_COLLAPSED_LIMIT && (
          <button
            type="button"
            className="bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold transition-colors"
            onClick={() => setTabsExpanded(v => !v)}
          >
            {tabsExpanded
              ? '收起'
              : `+${visibleTabs.length - TABS_COLLAPSED_LIMIT}`}
          </button>
        )}
      </div>

      {selectedTags.length > 1 && (
        <div className="mb-4">
          <OperatorToggle value={keywordOperator} onChange={setOperator} />
        </div>
      )}

      <div className="flex max-h-115 flex-wrap gap-2 overflow-auto">
        {filteredTechView.map(tech => {
          const isSelected = selectedTags.includes(tech.tech);
          const isExcluded = excludedTags.includes(tech.tech);
          return (
            <span
              key={tech.tech}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded px-4 py-2 text-sm font-bold ${
                isSelected
                  ? 'bg-primary text-on-primary'
                  : isExcluded
                    ? 'bg-error text-on-error'
                    : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
              }`}
              onClick={() => toggleLanguage(tech.tech)}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex min-w-0 items-center gap-2">
                  <TechIcon
                    slugs={tech.icon_slugs}
                    label={tech.label}
                    size={20}
                  />
                  <span className="truncate">{tech.label}</span>
                </span>

                {tech.tags?.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {tech.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-current/12 px-1.5 py-px text-[11px] font-medium normal-case"
                      >
                        {tagLabel(tag)}
                      </span>
                    ))}
                  </span>
                )}

                {tech.parents?.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1 normal-case opacity-70">
                    <span className="material-symbols-outlined text-[13px]! opacity-80">
                      subdirectory_arrow_right
                    </span>
                    {tech.parents.map(parent => (
                      <span
                        key={parent}
                        className="rounded-full border border-current/30 px-1.5 py-px text-[11px] font-medium"
                      >
                        {techByTech.get(parent)?.label ?? parent}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {isSelected ? (
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                ) : isExcluded ? (
                  <span className="material-symbols-outlined text-sm">
                    close
                  </span>
                ) : null}
                <span className="shrink-0 tabular-nums">{tech.count}</span>
              </span>
            </span>
          );
        })}
      </div>

      {tabTooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 rounded bg-[#001f2a] px-2 py-1 text-sm font-medium whitespace-nowrap text-white shadow"
            style={{
              left: `${tabTooltip.x}px`,
              top: `${tabTooltip.y - 8}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {tabTooltip.text}
          </div>,
          document.body,
        )}
    </section>
  );
}
