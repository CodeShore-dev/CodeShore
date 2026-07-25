import { TechIcon } from '../../../components/TechIcon';
import type { CategoryGroup } from '../hooks/useRegionTechCategoryRanking';

export interface RegionTechCategoryListProps {
  /**
   * 依分類分桶、每個分類最多 5 筆、已依 job_count 排序的技術排行
   * （`useRegionTechCategoryRanking`，task 16.2）。空分類已由該 hook 排除
   * （Requirement 5.5），此元件不需再自行過濾。
   */
  categoryGroups: CategoryGroup[];
  /** 點擊某一列技術時呼叫，帶出該列的 `tech` id（Requirement 6.3）。 */
  onSelectTech: (techId: string) => void;
}

/**
 * 地區摘要 popup 內的技術分類排行區塊（task 17.2，design.md
 * 「`components/RegionTechCategoryList.tsx`」／requirements.md 5.4, 5.5,
 * 6.3）。
 *
 * 純展示型元件：不呼叫任何 hook 或查詢，`categoryGroups` 完全由呼叫端
 * （`RegionSummaryPopup`，透過 `useRegionTechCategoryRanking`）算好傳入。
 *
 * 依分類垂直堆疊（Requirement 5.7：避免橫向並排多欄在窄螢幕造成溢出），
 * 每個分類一個標題 + 該分類的技術排行列（樣式參考既有
 * `TechRankingRow.tsx`／`RegionDetailPanel.tsx` 的排行列：rank 徽章 +
 * `TechIcon` + label + 職缺數，`CompanyDetailModal.tsx` 的「分類標題 + 列表」
 * 兩層結構）。
 *
 * `categoryGroups` 為空陣列（無任何技術資料）時不渲染任何內容——
 * Requirement 5.6 的整體無資料狀態訊息由呼叫端 `RegionSummaryPopup`
 * （task 17.3）負責顯示，本元件在該情境下單純不掛載。
 */
export function RegionTechCategoryList({
  categoryGroups,
  onSelectTech,
}: RegionTechCategoryListProps) {
  return (
    <div className="flex flex-col gap-4">
      {categoryGroups.map(group => (
        <div key={group.category} className="flex flex-col gap-2">
          <div className="text-[11px] font-bold tracking-[0.15em] text-[#434653]">
            {group.label}
          </div>
          <ul className="flex flex-col">
            {group.rows.map((row, index) => (
              <li
                key={row.tech}
                data-tech={row.tech}
                data-testid="region-tech-row"
                onClick={() => onSelectTech(row.tech)}
                className="flex cursor-pointer items-center gap-2 border-b border-[#eef3f8] py-2 transition-colors last:border-0 hover:bg-[#f4faff]"
              >
                <span className="font-mono text-xs text-[#434653]">
                  #{index + 1}
                </span>
                <TechIcon slugs={row.iconSlugs} label={row.label} size={22} />
                <span className="flex-1 font-black text-[#001f2a]">
                  {row.label}
                </span>
                <span className="font-black text-[#003d92] tabular-nums">
                  {row.jobCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
