import { useMemo } from 'react';

import { useTechsQuery } from '../../keyword/queries';
import type { LocationMapViewMode } from '../locationMapStore';

interface LocationMapHeaderProps {
  viewMode: LocationMapViewMode;
  selectedTech: string | null;
}

/**
 * 地圖頁面標題區塊：eyebrow + 大標題 + 目前檢視對象標籤（依使用者要求
 * 新增，讓使用者不需切換分頁就能看出目前地圖著色依據是「職缺數」還是
 * 某個具體技術）。抽成獨立元件以維持 `LocationMapPage.tsx` 在
 * `frontend-standards.md` 的 200 行元件上限內。
 *
 * 技術名稱查找重用 `ViewModeToggle`/`RegionDetailPanel` 已在用的同一份
 * `useTechsQuery` 技術目錄（不另建查詢），將 `tech` id 轉為可讀的
 * `label`（例如 "react" -> "React"）。
 */
export function LocationMapHeader({ viewMode, selectedTech }: LocationMapHeaderProps) {
  const { data: techs = [] } = useTechsQuery();
  const selectedTechLabel = useMemo(() => {
    if (!selectedTech) return null;
    return techs.find(t => t.tech === selectedTech)?.label ?? selectedTech;
  }, [techs, selectedTech]);
  const viewSubjectLabel =
    viewMode === 'tech' ? (selectedTechLabel ?? '技術（尚未選擇）') : '職缺數';

  return (
    <>
      <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
        ● 地區地圖 · LOCATION MAP
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
          職缺地圖
        </h1>
        <span className="rounded-full bg-[#003d92]/10 px-3 py-1 text-sm font-bold text-[#003d92]">
          目前檢視：{viewSubjectLabel}
        </span>
      </div>
    </>
  );
}
