import { useMemo } from 'react';

import { useLocationGroupsQuery } from '../queries';
import { groupByCounty } from '../utils/regionId';

/**
 * `useRegionValueMaps` 的回傳型別（task 6.2，design.md「資料合併模型」圖中
 * `RegionKeyMatch` 步驟；design.md 檔案結構規劃表 `hooks/useRegionValueMaps.ts`
 * 一列）。
 *
 * 刻意包成具名欄位的物件，而非直接回傳 `Map<string, number>`：task 7.2 會
 * 在同一個 hook 內擴充「技術」視角（依 `locationMapStore.selectedTech` 呼叫
 * `useLocationTechStatsQuery` 並同樣以 `groupByCounty` 加總），屆時只需在此
 * 介面新增一個並存欄位（例如技術視角專用的縣市層 `valueByRegionId`），呼叫端
 * 讀取 `countyValues` 的方式不需變更，避免 breaking change。
 */
export interface RegionValueMaps {
  /**
   * 縣市層 `valueByRegionId`：key 為 `utils/regionId.groupByCounty` 解析出的
   * 縣市名（已正規化「臺」→「台」，見 `normalizeCountyName`），value 為該縣市
   * 底下所有 `location_group` 列的開放中職缺數加總。
   *
   * 無法解析的 `location`（格式不符 `location_group.id` 慣例）已被
   * `groupByCounty` 排除，不會落入任何縣市的加總（Requirement 7.2）。
   */
  countyValues: Map<string, number>;
}

/**
 * 唯一的資料合併層（task 6.2，design.md 明確指出：`RegionChoropleth`／
 * `LocationMapPage` 皆不做資料聚合，聚合邏輯只存在於這個 hook）。
 *
 * 這裡先只實作「職缺數」視角：重用 `../queries` 已重新匯出的
 * `features/job/queries.ts`「useLocationGroupsQuery`（`mv_location_group`，
 * 全部地區、開放中職缺數，Requirement 2.1, 2.2），透過 `groupByCounty` 依縣市
 * 加總每個 `location_group` 列的 `count`。「技術」視角（task 7.2）會在此檔案
 * 內擴充，不會另立新 hook。
 */
export function useRegionValueMaps(): RegionValueMaps {
  const { data: locationGroups } = useLocationGroupsQuery();

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

  return { countyValues };
}
