import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { TechIcon } from '../../../components/TechIcon';
import { useTechsQuery } from '../../keyword/queries';
import { useLocationGroupsQuery, useLocationTechStatsQuery } from '../queries';
import { groupByCounty } from '../utils/regionId';

/**
 * 目前選定地區所屬的層級（task 8.2, design.md「跳轉回職缺頁」
 * requirements.md 6.1/6.2）。「查看此地區職缺」的行為依層級而不同：
 * - `'county'`：`regionId` 是正規化縣市名（design.md `RegionFeature.id` 於
 *   縣市層級的定義），需透過 `groupByCounty` 展開為該縣市底下所有
 *   `location_group` id 才能組出 `locations` 參數。
 * - `'district'`：`regionId` 本身就是單一 `location_group.id`，可直接使用。
 *
 * design.md 的 `RegionDetailPanelProps`（task 8.1 引用段落）沒有涵蓋這個欄
 * 位——task 8.1 當時範圍不包含跳轉邏輯。這裡是本任務（8.2）新增的最小必要
 * 擴充：沒有它就無法讓同一個元件依層級套用不同的「查看此地區職缺」行為。
 */
export type RegionDetailPanelTier = 'county' | 'district';

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
  /** 目前選定地區的層級，見上方 `RegionDetailPanelTier` 說明。 */
  tier: RegionDetailPanelTier;
}

const TOP_N = 10;

/**
 * 地區明細面板（task 8.1 建立顯示邏輯／design.md「RegionDetailPanel.tsx」／
 * requirements.md 5.1-5.3；task 8.2 擴充跳轉回職缺頁邏輯／
 * requirements.md 6.1-6.4, 7.4）。顯示選定地區的開放中職缺總數、依開放中
 * 職缺數排序的 Top 10 技術排行（列樣式參考 `TechRankingRow.tsx`：icon +
 * label + 職缺數），並提供：
 * - 「查看此地區職缺」操作：依 `tier` 組出 `locations` 參數並
 *   `navigate('/jobs?' + new URLSearchParams({ locations }))`（比照
 *   `CompanyListPage.tsx`/`TechRankingRow.tsx` 既有的 `navigate` 寫法）。
 * - 技術排行列點擊：同時帶入 `locations`（同一套依 `tier` 決定的地區
 *   id 清單）與 `tags`（該列的技術 id）。
 *
 * Requirement 5.3：職缺總數為 0 時，顯示無資料說明，且技術排行清單必須
 * 完全不渲染（不是渲染一個空清單）。「查看此地區職缺」操作不受此條件影響
 * （Requirement 6.1/6.2 並未將其與職缺總數是否為 0 綁定）。
 */
export function RegionDetailPanel({
  regionId,
  displayName,
  totalJobCount,
  tier,
}: RegionDetailPanelProps) {
  const navigate = useNavigate();

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

  // 縣市層級「查看此地區職缺」需要該縣市底下所有 `location_group` id
  // ——來源是既有 `/api/job/location` 全量結果（`useLocationGroupsQuery`，
  // task 5.1 已重新匯出），套用 `utils/regionId.groupByCounty`（task 4.1）
  // 依縣市分組後取出對應 bucket，而不是重新實作一次分組邏輯（design.md
  // 「groupByCounty」註解明確要求 `RegionDetailPanel` 共用此函式）。
  // 這個 hook 在鄉鎮市區層級也會呼叫（React hook 不能依 `tier` 條件式呼叫），
  // 但 `useLocationGroupsQuery` 的 queryKey 與 `useRegionValueMaps`（task 6.2）
  // 在同一頁面上呼叫的是同一份快取，鄉鎮市區層級渲染時不會產生額外的
  // 網路請求。
  const { data: allLocationGroups = [] } = useLocationGroupsQuery();

  const locationIds = useMemo(() => {
    if (tier === 'district') {
      return [regionId];
    }
    const bucket = groupByCounty(allLocationGroups).get(regionId);
    return (bucket ?? []).map(row => row.location);
  }, [tier, regionId, allLocationGroups]);

  const locationsParam = useMemo(() => locationIds.join(','), [locationIds]);

  const goToJobs = useCallback(() => {
    navigate(`/jobs?${new URLSearchParams({ locations: locationsParam })}`);
  }, [navigate, locationsParam]);

  const goToJobsWithTech = useCallback(
    (techId: string) => {
      navigate(
        `/jobs?${new URLSearchParams({
          locations: locationsParam,
          tags: techId,
        })}`,
      );
    },
    [navigate, locationsParam],
  );

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

      <button
        type="button"
        onClick={goToJobs}
        className="mt-3 cursor-pointer rounded-lg bg-[#003d92] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9] active:scale-95"
      >
        查看此地區職缺
      </button>

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
                onClick={() => goToJobsWithTech(techId)}
                className="flex cursor-pointer items-center gap-2 border-b border-[#eef3f8] py-2 transition-colors last:border-0 hover:bg-[#f4faff]"
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
