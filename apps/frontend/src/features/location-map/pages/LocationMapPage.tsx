import { useMemo } from 'react';

import { PageSeo } from '../../../components/PageSeo';
import { env } from '../../../config/env';
import { LocationMapHeader } from '../components/LocationMapHeader';
import { RegionChoropleth, type RegionFeature } from '../components/RegionChoropleth';
import { RegionDetailPanel, type RegionDetailPanelTier } from '../components/RegionDetailPanel';
import { RegionMapError } from '../components/RegionMapError';
import { RegionMapSkeleton } from '../components/RegionMapSkeleton';
import { ViewModeToggle } from '../components/ViewModeToggle';
import { useRegionValueMaps } from '../hooks/useRegionValueMaps';
import { useLocationMapStore } from '../locationMapStore';
import { useLocationGroupsQuery, useLocationTechStatsQuery } from '../queries';
import { normalizeCountyName, toRegionKey } from '../utils/regionId';
import {
  getCountiesFeatureCollection,
  getTownsFeatureCollection,
} from '../utils/taiwanAtlasData';

/**
 * `LocationMapPage`（task 9.1，design.md「LocationMapPage.tsx」／requirements.md
 * 1.1-1.4, 2.1-2.3, 3.1-3.3, 7.3）——組裝所有已完成的子元件與資料流的唯一
 * 位置。這裡是本 feature 內唯一同時讀取 `taiwan-atlas`（幾何）與
 * `useRegionValueMaps`/`useLocationGroupsQuery`/`useLocationTechStatsQuery`
 * （統計數值）並將兩者合併為 `RegionChoropleth` 所需 `RegionFeature[]` +
 * `valueByRegionId` 的地方（design.md「資料合併模型」的 `RegionKeyMatch` 對
 * 縣市層在 `useRegionValueMaps` 完成，鄉鎮市區層與「哪一份數值該顯示」的
 * 揀選則是本頁面的職責）。
 *
 * 只提供檢視/下鑽/跳轉：無任何新增、編輯、刪除地區分組或技術分類的操作
 * 入口（Requirement 7.3）。
 */

// 外島距離本島遙遠，納入 fitSize 計算範圍會迫使本島顯得過小；排除後地圖
// 只顯示/可點選本島＋鄰近離島。歸屬這三縣的職缺不受影響，仍計入 /jobs
// 頁與明細面板的統計，只是無法從地圖介面到達。
const EXCLUDED_OUTLYING_COUNTIES = new Set(['金門縣', '連江縣', '澎湖縣']);

// 縣市層 `RegionFeature[]`——比照 `RegionChoropleth.test.tsx` 的
// `buildCountyFeatures` 參考實作（唯一已驗證正確的 taiwan-atlas → RegionFeature
// 正規化寫法），id 一律先經 `normalizeCountyName` 正規化，才能與
// `useRegionValueMaps` 回傳的 Map 鍵（來自 `location_group.id`，慣例用「台」）
// 對得上（task 6.2 review 標記的風險）。
function buildCountyFeatures(): RegionFeature[] {
  return getCountiesFeatureCollection()
    .features.map(feature => {
      const id = normalizeCountyName(feature.properties.COUNTYNAME);
      return { id, displayName: id, geometry: feature.geometry };
    })
    .filter(feature => !EXCLUDED_OUTLYING_COUNTIES.has(feature.id));
}

// 鄉鎮市區層 `RegionFeature[]`——同樣比照 `RegionChoropleth.test.tsx` 的
// `buildTownFeatures`：只取出已下鑽縣市的子集，`id` 使用 `toRegionKey`
// 組出與 `location_group.id` 相容的字串。
function buildTownFeatures(county: string): RegionFeature[] {
  return getTownsFeatureCollection()
    .features.filter(f => normalizeCountyName(f.properties.COUNTYNAME) === county)
    .map(f => ({
      id: toRegionKey(f.properties.COUNTYNAME, f.properties.TOWNNAME),
      displayName: f.properties.TOWNNAME,
      geometry: f.geometry,
    }));
}

export function LocationMapPage() {
  const viewMode = useLocationMapStore(s => s.viewMode);
  const selectedCounty = useLocationMapStore(s => s.selectedCounty);
  const selectedDistrict = useLocationMapStore(s => s.selectedDistrict);
  const selectedTech = useLocationMapStore(s => s.selectedTech);
  const setSelectedCounty = useLocationMapStore(s => s.setSelectedCounty);
  const setSelectedDistrict = useLocationMapStore(s => s.setSelectedDistrict);

  // 縣市層職缺數／技術數視角的加總值（唯一資料合併層，task 6.2/7.2）。
  const { countyValues, techCountyValues } = useRegionValueMaps();

  // 縣市層之外，本頁另需「單一 location_group（鄉鎮市區）」粒度的原始數值
  // ——`useRegionValueMaps` 只算縣市層加總（見該檔案註解），鄉鎮市區下鑽的
  // 逐地區數值由本頁直接讀取同一份（已快取、不產生額外請求）查詢結果組出。
  const locationGroupsQuery = useLocationGroupsQuery();
  const locationGroups = locationGroupsQuery.data ?? [];

  const techStatsQuery = useLocationTechStatsQuery(
    { tech: { eq: selectedTech } },
    { from: 0, to: -1, enabled: Boolean(selectedTech) },
  );

  const isDrilledIn = selectedCounty !== null;

  const countyFeatures = useMemo(buildCountyFeatures, []);
  const townFeatures = useMemo(
    () => (selectedCounty ? buildTownFeatures(selectedCounty) : []),
    [selectedCounty],
  );
  const features = isDrilledIn ? townFeatures : countyFeatures;

  const townJobCountValues = useMemo(
    () => new Map(locationGroups.map(row => [row.location, row.count])),
    [locationGroups],
  );
  const townTechValues = useMemo(() => {
    if (!selectedTech) return new Map<string, number>();
    return new Map((techStatsQuery.data ?? []).map(row => [row.location, row.job_count]));
  }, [techStatsQuery.data, selectedTech]);

  // Requirement 4.3：技術視角尚未選定技術時，地圖維持中性（空 Map ->
  // 每個地區都落在 getRegionColor(0, 0) 的最淺一階，視覺上一致無差異）。
  const valueByRegionId = useMemo(() => {
    if (viewMode === 'tech') {
      if (!selectedTech) return new Map<string, number>();
      return isDrilledIn ? townTechValues : techCountyValues;
    }
    return isDrilledIn ? townJobCountValues : countyValues;
  }, [
    viewMode,
    selectedTech,
    isDrilledIn,
    townTechValues,
    techCountyValues,
    townJobCountValues,
    countyValues,
  ]);

  const maxValue = useMemo(
    () => Math.max(0, ...features.map(f => valueByRegionId.get(f.id) ?? 0)),
    [features, valueByRegionId],
  );

  const handleSelectRegion = isDrilledIn ? setSelectedDistrict : setSelectedCounty;
  // 「返回全台總覽」（task 6.3 review 標記為延後到本任務處理）：
  // `setSelectedCounty(null)` 依 store 既有行為一併清空 `selectedDistrict`。
  const handleReturnToOverview = () => setSelectedCounty(null);

  const panelRegionId = selectedDistrict ?? selectedCounty;
  const panelTier: RegionDetailPanelTier = selectedDistrict ? 'district' : 'county';
  // 職缺總數一律取自職缺數資料（不受目前 viewMode 影響），比照
  // `RegionDetailPanel` 自身文件註解的要求。
  const panelTotalJobCount = selectedDistrict
    ? (townJobCountValues.get(selectedDistrict) ?? 0)
    : (countyValues.get(selectedCounty ?? '') ?? 0);

  return (
    <div className="w-full">
      <PageSeo
        title="職缺地圖"
        description="以台灣地圖檢視職缺與技術在各縣市、鄉鎮市區的分布，一鍵跳轉查看符合條件的職缺。"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首頁', item: `${env.siteUrl}/` },
            { '@type': 'ListItem', position: 2, name: '地圖', item: `${env.siteUrl}/location-map` },
          ],
        }}
      />

      <LocationMapHeader viewMode={viewMode} selectedTech={selectedTech} />

      {locationGroupsQuery.isLoading ? (
        <RegionMapSkeleton />
      ) : locationGroupsQuery.isError ? (
        <RegionMapError onRetry={() => locationGroupsQuery.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <ViewModeToggle />

          {isDrilledIn && (
            <button
              type="button"
              className="flex w-fit cursor-pointer items-center gap-1 text-sm font-bold text-[#003d92]"
              onClick={handleReturnToOverview}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
              返回全台總覽
            </button>
          )}

          <div className="rounded-xl bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
            <RegionChoropleth
              features={features}
              valueByRegionId={valueByRegionId}
              maxValue={maxValue}
              selectedRegionId={isDrilledIn ? selectedDistrict : null}
              onSelect={handleSelectRegion}
            />
          </div>

          {panelRegionId && (
            <RegionDetailPanel
              regionId={panelRegionId}
              displayName={panelRegionId}
              totalJobCount={panelTotalJobCount}
              tier={panelTier}
            />
          )}
        </div>
      )}
    </div>
  );
}
