import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';

import { useLocationGroupsQuery } from '../queries';
import { groupByCounty } from '../utils/regionId';

/**
 * `useRegionJobsNavigation` 回傳的介面（task 16.3，design.md「檔案結構規劃」
 * `hooks/useRegionJobsNavigation.ts` 行、design.md `RegionSummaryPopup`
 * 依賴清單：`useRegionJobsNavigation`）。
 */
export interface RegionJobsNavigation {
  /** 依 `tier`/`regionId` 組出 `locations` 參數並導向 `/jobs`。 */
  goToJobs: () => void;
  /** 同時帶入 `locations`（同一套依 `tier` 決定的地區 id 清單）與
   *  `tags`（`techId`）並導向 `/jobs`。 */
  goToJobsWithTech: (techId: string) => void;
}

/**
 * 由 `RegionDetailPanel.tsx`（task 8.2）抽出的既有跳轉回職缺頁邏輯（task
 * 16.3，design.md「檔案結構規劃」`hooks/useRegionJobsNavigation.ts` 行：
 * 「由 `RegionDetailPanel.tsx` 抽出的既有跳轉邏輯……供 `RegionSummaryPopup`
 * 使用，行為不變」）。純抽取，未變更任何計算或 `navigate` URL 格式：
 *
 * - `tier === 'district'`：`regionId` 本身就是單一 `location_group.id`，
 *   直接使用（design.md `RegionFeature.id` 於鄉鎮市區層級的定義）。
 * - `tier === 'county'`：`regionId` 是正規化縣市名，透過
 *   `utils/regionId.groupByCounty`（task 4.1，與 `useRegionValueMaps`/
 *   `useRegionSalaryStats`/`useRegionTechCategoryRanking` 共用同一實作，不
 *   重新分組）從既有 `/api/job/location` 全量結果中展開為該縣市底下所有
 *   `location_group` id。
 *
 * Requirements: 6.1（縣市層展開為所有 `location_group` id）、6.2（鄉鎮市區層
 * 使用單一 id）、6.3（技術排行點擊同時帶 `locations`/`tags`）、6.4（維持
 * `navigate` URL 格式不變）、7.4（沿用既有 `/api/job/location` 資料範圍與
 * `groupByCounty` 對格式不符列的排除）。
 */
export function useRegionJobsNavigation(
  regionId: string,
  tier: 'county' | 'district',
): RegionJobsNavigation {
  const navigate = useNavigate();

  // 縣市層級展開所需的全量 `location_group` 列表 -- 與 `RegionDetailPanel`
  // 當年的呼叫方式相同，鄉鎮市區層級也會呼叫這個 hook（React hook 不能依
  // `tier` 條件式呼叫），但與同頁面上其他 hook 共用同一份 TanStack Query
  // 快取，不會產生額外的網路請求。
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

  return { goToJobs, goToJobsWithTech };
}
