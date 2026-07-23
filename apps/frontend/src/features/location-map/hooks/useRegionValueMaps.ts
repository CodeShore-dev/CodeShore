import { useMemo } from 'react';

import { useLocationMapStore } from '../locationMapStore';
import { useLocationGroupsQuery, useLocationTechStatsQuery } from '../queries';
import { groupByCounty } from '../utils/regionId';

/**
 * `useRegionValueMaps` 的回傳型別（task 6.2/7.2，design.md「資料合併模型」圖中
 * `RegionKeyMatch` 步驟；design.md 檔案結構規劃表 `hooks/useRegionValueMaps.ts`
 * 一列）。
 *
 * 刻意包成具名欄位的物件，而非直接回傳 `Map<string, number>`：task 6.2 選擇
 * 這個形狀就是為了讓 task 7.2 能在此介面新增一個並存欄位
 * （`techCountyValues`），呼叫端讀取 `countyValues` 的方式不需變更，避免
 * breaking change。design.md 對本 hook 的描述（「依目前 viewMode/selectedTech
 * ...彙總為縣市層與鄉鎮市區層兩份 valueByRegionId」）與 tasks.md 7.2
 * 的「`LocationMapPage` 依 `viewMode` 決定將此 hook 回傳的哪一份
 * `valueByRegionId` 傳入 `RegionChoropleth`」一致：這個 hook 只負責算出兩個
 * 視角各自的縣市層數值，實際依 `viewMode` 挑選哪一份給 `RegionChoropleth`
 * 是呼叫端（`LocationMapPage`，task 9.1）的責任，這裡不做視角揀選。
 */
export interface RegionValueMaps {
  /**
   * 縣市層 `valueByRegionId`（職缺數視角）：key 為
   * `utils/regionId.groupByCounty` 解析出的縣市名（已正規化「臺」→「台」，
   * 見 `normalizeCountyName`），value 為該縣市底下所有 `location_group` 列的
   * 開放中職缺數加總。
   *
   * 無法解析的 `location`（格式不符 `location_group.id` 慣例）已被
   * `groupByCounty` 排除，不會落入任何縣市的加總（Requirement 7.2）。
   */
  countyValues: Map<string, number>;

  /**
   * 縣市層 `valueByRegionId`（技術視角，task 7.2）：當
   * `locationMapStore.selectedTech` 有選定技術時，key 為
   * `groupByCounty` 解析出的縣市名，value 為該縣市底下所有 `location_group`
   * 在該技術上的開放中職缺數加總（`mv_location_tech` 的 `job_count`）——即
   * Requirement 4.2「依各地區在該技術上的開放中職缺數量重新著色」的縣市層
   * 加總口徑。
   *
   * 尚未選定任何技術時（`selectedTech` 為 `null`，Requirement 4.3 的中性
   * 狀態）此 Map 一律為空，不會回退顯示職缺數視角的數值，避免誤導呼叫端
   * 誤以為是技術視角的著色資料。
   *
   * 無法解析的 `location` 同樣被 `groupByCounty` 排除，不會落入任何縣市的
   * 加總（Requirement 7.2）。
   */
  techCountyValues: Map<string, number>;
}

/**
 * 唯一的資料合併層（task 6.2/7.2，design.md 明確指出：`RegionChoropleth`／
 * `LocationMapPage` 皆不做資料聚合，聚合邏輯只存在於這個 hook）。
 *
 * 「職缺數」視角：重用 `../queries` 已重新匯出的 `features/job/queries.ts`
 * 的 `useLocationGroupsQuery`（`mv_location_group`，全部地區、開放中職缺數，
 * Requirement 2.1, 2.2），透過 `groupByCounty` 依縣市加總每個 `location_group`
 * 列的 `count`。
 *
 * 「技術」視角（task 7.2）：讀取 `locationMapStore.selectedTech`，呼叫
 * `useLocationTechStatsQuery({ tech: { eq: selectedTech } }, { from: 0, to:
 * -1 })` 取得該技術在全部地區的開放中職缺數（design.md「MvLocationTechService
 * （Service Contract）」呼叫端使用方式的「技術視角地圖著色」案例），同樣透過
 * `groupByCounty` 依縣市加總 `job_count`。
 */
export function useRegionValueMaps(): RegionValueMaps {
  const { data: locationGroups } = useLocationGroupsQuery();

  const selectedTech = useLocationMapStore(state => state.selectedTech);

  // Hooks must be called unconditionally regardless of whether a tech is
  // currently selected -- `selectedTech` can be `null` here (Requirement
  // 4.3's neutral state). `enabled: Boolean(selectedTech)` stops TanStack
  // Query from firing the request at all until a tech is actually chosen
  // (no point hitting the API on every page load just to discard the
  // result); the `techCountyValues` memo below still independently
  // short-circuits on `selectedTech` as a second guard, so a `null`
  // selection never leaks stale or unrelated data into the tech view even
  // if a previous query's cached data is still sitting there.
  const { data: techStats } = useLocationTechStatsQuery(
    { tech: { eq: selectedTech } },
    { from: 0, to: -1, enabled: Boolean(selectedTech) },
  );

  const countyValues = useMemo(() => {
    const rows = locationGroups ?? [];
    const grouped = groupByCounty(rows);

    const values = new Map<string, number>();
    for (const [county, countyRows] of grouped) {
      const total = countyRows.reduce((sum, row) => sum + row.count, 0);
      values.set(county, total);
    }
    return values;
  }, [locationGroups]);

  const techCountyValues = useMemo(() => {
    const values = new Map<string, number>();
    // Requirement 4.3: while no tech is selected, the tech view stays
    // neutral -- never fold job-count data (or stale/unrelated tech query
    // results) into this map as a misleading substitute.
    if (!selectedTech) {
      return values;
    }

    const rows = techStats ?? [];
    const grouped = groupByCounty(rows);
    for (const [county, countyRows] of grouped) {
      const total = countyRows.reduce((sum, row) => sum + row.job_count, 0);
      values.set(county, total);
    }
    return values;
  }, [techStats, selectedTech]);

  return { countyValues, techCountyValues };
}
