import { useState } from 'react';

import { TechIcon } from '../../../components/TechIcon';
import { useTechsQuery } from '../../keyword/queries';
import { useLocationMapStore, type LocationMapViewMode } from '../locationMapStore';

// 「職缺數／技術」視角切換 tab（task 7.1，design.md「ViewModeToggle.tsx」／
// requirements.md 4.1-4.3）。技術視角下顯示技術搜尋選單（單選），樣式沿用
// `JobLocationFilterPanel.tsx` 的搜尋框＋清單樣式（改為單選：選中即取代前一個
// 選擇，而非像地區篩選那樣可複選）。技術清單資料重用既有
// `useTechsQuery`（`CompanyListPage.tsx` 已在使用同一支 hook），不另建新的
// 技術抓取機制。
//
// Requirement 4.3：處於技術視角但 selectedTech 為 null 時，顯示提示文字
// 「請選擇一個技術」且不得自動選取清單第一項——這個狀態本身已透過
// `locationMapStore`（viewMode === 'tech' && selectedTech === null）可被
// 呼叫端（`RegionChoropleth` 的呼叫端 `LocationMapPage`）讀取以判斷是否要
// 以中性色呈現地圖，本元件只需忠實渲染對應的提示文案。
const VIEW_MODE_TABS: { value: LocationMapViewMode; label: string }[] = [
  { value: 'jobCount', label: '職缺數' },
  { value: 'tech', label: '技術' },
];

export function ViewModeToggle() {
  const viewMode = useLocationMapStore(s => s.viewMode);
  const setViewMode = useLocationMapStore(s => s.setViewMode);
  const selectedTech = useLocationMapStore(s => s.selectedTech);
  const setSelectedTech = useLocationMapStore(s => s.setSelectedTech);

  const { data: techs = [], isLoading: techsLoading } = useTechsQuery();

  const [techSearch, setTechSearch] = useState('');
  const q = techSearch.trim().toLowerCase();
  const filteredTechs = techs.filter(
    t => !!t.tech && (t.label ?? t.tech).toLowerCase().includes(q),
  );

  return (
    <section>
      <div role="tablist" className="flex gap-2">
        {VIEW_MODE_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={viewMode === tab.value}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              viewMode === tab.value
                ? 'bg-[#003d92] text-white'
                : 'bg-white text-[#434653] hover:bg-[#f4faff]'
            }`}
            onClick={() => setViewMode(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {viewMode === 'tech' && (
        <div className="mt-3">
          {selectedTech === null && (
            <p className="mb-2 text-sm font-bold text-[#fd7700]">
              請選擇一個技術
            </p>
          )}
          <div className="relative mb-3">
            <span className="material-symbols-outlined text-[#434653]/60 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">
              search
            </span>
            <input
              value={techSearch}
              type="text"
              placeholder="搜尋技術..."
              className="w-full rounded-lg border border-[#c3c6d5] bg-white py-2 pr-8 pl-9 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:outline-none"
              onChange={e => setTechSearch(e.target.value)}
            />
            {techSearch && (
              <button
                type="button"
                className="absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer text-[#434653] hover:text-[#001f2a]"
                onClick={() => setTechSearch('')}
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
          {techsLoading ? (
            <div className="text-sm text-[#434653]">載入中...</div>
          ) : (
            <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
              {filteredTechs.map(t => {
                const isSelected = t.tech === selectedTech;
                return (
                  <span
                    key={t.tech}
                    data-tech={t.tech}
                    data-selected={isSelected}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded px-4 py-2 text-sm font-bold ${
                      isSelected
                        ? 'bg-[#003d92] text-white'
                        : 'bg-[#f4faff] text-[#434653] hover:bg-[#c9e7f7]'
                    }`}
                    onClick={() => setSelectedTech(t.tech as string)}
                  >
                    <TechIcon slugs={t.icon_slugs} label={t.label} size={18} />
                    <span>{t.label ?? t.tech}</span>
                  </span>
                );
              })}
              {!filteredTechs.length && techSearch && (
                <span className="px-4 py-2 text-sm text-[#434653]">
                  沒有符合的技術
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
