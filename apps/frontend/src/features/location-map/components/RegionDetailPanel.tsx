import { useMemo } from 'react';

import { TechIcon } from '../../../components/TechIcon';
import { useTechsQuery } from '../../keyword/queries';
import { useLocationTechStatsQuery } from '../queries';

export interface RegionDetailPanelProps {
  /** `location_group.id` 相容字串（縣市或鄉鎮市區皆可，task 8.1）。 */
  regionId: string;
  /** 顯示用地區名稱（例如「台北市信義區」）。 */
  displayName: string;
  /**
   * 該地區的開放中職缺總數。刻意由呼叫端（未來的 `LocationMapPage`／
   * `useRegionValueMaps`，design.md「資料合併模型」）算好傳入，而不是本元件
   * 自行再發一次查詢：職缺總數（依 `location_group` 去重計數）與本元件另外
   * 呼叫的技術排行（依 `tech` 分組計數）口徑不同，加總技術排行的
   * `job_count` 會因一筆職缺對應多項技術而重複計數，不能拿來當作總數的
   * 替代來源。
   */
  totalJobCount: number;
}

const TOP_N = 10;

/**
 * 地區明細面板（task 8.1，design.md「RegionDetailPanel.tsx」／
 * requirements.md 5.1-5.3）。顯示選定地區的開放中職缺總數，以及依開放中
 * 職缺數排序的 Top 10 技術排行（列樣式參考 `TechRankingRow.tsx`：icon +
 * label + 職缺數）。
 *
 * Requirement 5.3：職缺總數為 0 時，顯示無資料說明，且技術排行清單必須
 * 完全不渲染（不是渲染一個空清單）。
 *
 * 本任務不包含「查看此地區職缺」／技術點擊跳轉的 `navigate` 邏輯（design.md
 * 標記為後續任務 8.2 的範圍），故本元件目前不呼叫 `useNavigate`。
 */
export function RegionDetailPanel({
  regionId,
  displayName,
  totalJobCount,
}: RegionDetailPanelProps) {
  // 呼叫方式固定比照 design.md「MvLocationTechService（Service Contract）」
  // 呼叫端使用方式 -- 地區明細面板一列：`where = { location: { eq: regionId } }`，
  // `from: 0, to: 9`（Top 10），`orders: 'job_count:desc'`。
  const { data: techStats = [] } = useLocationTechStatsQuery(
    { location: { eq: regionId } },
    { from: 0, to: 9, orders: 'job_count:desc' },
  );

  // `mv_location_tech` 每一列只帶 `tech` id（不含 label/icon_slugs），要比照
  // `TechRankingRow.tsx` 呈現 icon + label，需要另外查一次共用技術目錄
  // (`useTechsQuery`，`../../keyword/queries`)。這與同一 feature 內
  // `ViewModeToggle.tsx` 解同一問題的方式一致，避免另建一套技術抓取機制。
  const { data: techs = [] } = useTechsQuery();

  const techMetaByTech = useMemo(() => {
    const map = new Map<
      string,
      { label: string; icon_slugs: string[] | null }
    >();
    for (const t of techs) {
      if (!t.tech) continue;
      map.set(t.tech, { label: t.label ?? t.tech, icon_slugs: t.icon_slugs ?? null });
    }
    return map;
  }, [techs]);

  const hasJobs = totalJobCount > 0;
  // 伺服器端已透過 `to: 9` 限制為前 10 筆，這裡再做一次防禦性裁切，確保
  // 元件本身也不會因為呼叫端/mock 回傳超過 10 筆而多渲染。
  const rankingRows = hasJobs ? techStats.slice(0, TOP_N) : [];

  return (
    <section aria-label="地區明細" data-region-id={regionId}>
      <h2 className="font-black text-[#001f2a]">{displayName}</h2>
      <p className="mt-1 text-sm text-[#434653]">
        開放中職缺總數：
        <span className="font-black text-[#003d92] tabular-nums">
          {totalJobCount.toLocaleString()}
        </span>
      </p>

      {!hasJobs ? (
        <p className="mt-4 text-sm text-[#434653]">此地區目前沒有開放中職缺</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {rankingRows.map((row, index) => {
            const techId = row.tech ?? '';
            const meta = techMetaByTech.get(techId) ?? {
              label: techId,
              icon_slugs: null,
            };

            return (
              <li
                key={techId || index}
                data-tech={techId}
                className="flex items-center gap-2 border-b border-[#eef3f8] py-2 last:border-0"
              >
                <span className="font-mono text-xs text-[#434653]">
                  #{index + 1}
                </span>
                <TechIcon
                  slugs={meta.icon_slugs}
                  label={meta.label}
                  size={22}
                />
                <span className="flex-1 font-black text-[#001f2a]">
                  {meta.label}
                </span>
                <span className="font-black text-[#003d92] tabular-nums">
                  {(row.job_count ?? 0).toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
