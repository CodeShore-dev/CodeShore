import { useMemo } from 'react';

import { PageSeo } from '../../../components/PageSeo';
import { env } from '../../../config/env';
import { LocationMapHeader } from '../components/LocationMapHeader';
import { RegionChoropleth, type RegionFeature } from '../components/RegionChoropleth';
import { RegionMapError } from '../components/RegionMapError';
import { RegionMapSkeleton } from '../components/RegionMapSkeleton';
import { RegionSummaryPopup, type RegionSummaryTier } from '../components/RegionSummaryPopup';
import { useRegionValueMaps } from '../hooks/useRegionValueMaps';
import { useLocationMapStore } from '../locationMapStore';
import { useLocationGroupsQuery } from '../queries';
import { normalizeCountyName, toRegionKey } from '../utils/regionId';
import {
  getCountiesFeatureCollection,
  getTownsFeatureCollection,
} from '../utils/taiwanAtlasData';

/**
 * `LocationMapPage`（task 9.1，design.md「LocationMapPage.tsx」／requirements.md
 * 1.1-1.4, 2.1-2.3, 3.1-3.4, 7.3；task 18.1 移除技術視角、改接
 * `RegionSummaryPopup`）——組裝所有已完成的子元件與資料流的唯一位置。這裡是
 * 本 feature 內唯一同時讀取 `taiwan-atlas`（幾何）與
 * `useRegionValueMaps`/`useLocationGroupsQuery`（統計數值）並將兩者合併為
 * `RegionChoropleth` 所需 `RegionFeature[]` + `valueByRegionId` 的地方
 * （design.md「資料合併模型」的 `RegionKeyMatch` 對縣市層在
 * `useRegionValueMaps` 完成，鄉鎮市區層的逐地區數值則是本頁面的職責）。
 *
 * 只提供檢視/下鑽/跳轉：無任何新增、編輯、刪除地區分組或技術分類的操作
 * 入口（Requirement 7.3）。
 *
 * task 18.1（Requirement 3.1, 3.2, 4.1, 4.2）：點選縣市不再直接下鑽，改開啟
 * 該縣市的 `RegionSummaryPopup`（`setOpenCountySummaryId`）；使用者在 popup
 * 內點擊「進入鄉鎮市區分布」才真正下鑽（`setSelectedCounty`，其副作用已在
 * `locationMapStore` 一併清空 `openCountySummaryId`）。地圖著色一律依職缺數
 * （不再有可切換的「技術」視角，技術面向改由 popup 內的
 * `RegionTechCategoryList` 呈現）。
 */

// 外島距離本島遙遠，納入 fitSize 計算範圍會迫使本島顯得過小；排除後地圖
// 只顯示/可點選本島＋鄰近離島。歸屬這三縣的職缺不受影響，仍計入 /jobs
// 頁與地區摘要 popup 的統計，只是無法從地圖介面到達。
const EXCLUDED_OUTLYING_COUNTIES = new Set(['金門縣', '連江縣', '澎湖縣']);

// 行動裝置初始聚焦地區：北北基（台北市／新北市／基隆市）是職缺密度最高的
// 區域，讓行動裝置版面一進畫面就先放大聚焦在這裡，其餘縣市則靠使用者自行
// 拖曳/滑動地圖捲動查看（僅在縣市總覽層級套用，下鑽到單一縣市的鄉鎮市區
// 層級不需要）。
const MOBILE_INITIAL_FOCUS_COUNTIES = ['台北市', '新北市', '基隆市'];

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
  const selectedCounty = useLocationMapStore(s => s.selectedCounty);
  const selectedDistrict = useLocationMapStore(s => s.selectedDistrict);
  const openCountySummaryId = useLocationMapStore(s => s.openCountySummaryId);
  const setSelectedCounty = useLocationMapStore(s => s.setSelectedCounty);
  const setSelectedDistrict = useLocationMapStore(s => s.setSelectedDistrict);
  const setOpenCountySummaryId = useLocationMapStore(s => s.setOpenCountySummaryId);

  // 縣市層職缺數視角的加總值（唯一資料合併層，task 6.2；task 18.1 移除了
  // 技術視角的 `techCountyValues`，這裡只剩職缺數這一份）。
  const { countyValues } = useRegionValueMaps();

  // 縣市層之外，本頁另需「單一 location_group（鄉鎮市區）」粒度的原始數值
  // ——`useRegionValueMaps` 只算縣市層加總（見該檔案註解），鄉鎮市區下鑽的
  // 逐地區數值由本頁直接讀取同一份（已快取、不產生額外請求）查詢結果組出。
  const locationGroupsQuery = useLocationGroupsQuery();
  const locationGroups = locationGroupsQuery.data ?? [];

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

  // 地圖著色一律依職缺數（Requirement 4.1：不再提供可切換的「技術」視角）。
  const valueByRegionId = useMemo(
    () => (isDrilledIn ? townJobCountValues : countyValues),
    [isDrilledIn, townJobCountValues, countyValues],
  );

  const maxValue = useMemo(
    () => Math.max(0, ...features.map(f => valueByRegionId.get(f.id) ?? 0)),
    [features, valueByRegionId],
  );

  // 縣市層點選改為開啟地區摘要 popup（Requirement 3.1），不再直接下鑽；
  // 鄉鎮市區層點選行為不變，仍直接更新 `selectedDistrict`。
  const handleSelectRegion = isDrilledIn ? setSelectedDistrict : setOpenCountySummaryId;
  // 「返回全台總覽」：`setSelectedCounty(null)` 依 store 既有行為一併清空
  // `selectedDistrict` 與 `openCountySummaryId`（task 18.1），確保回到總覽後
  // 不會殘留任何開啟中的 popup。
  const handleReturnToOverview = () => setSelectedCounty(null);

  // 目前應顯示的地區摘要（縣市層讀 `openCountySummaryId`，鄉鎮市區層讀
  // `selectedDistrict`）——design.md「系統流程」點選地區 -> popup -> 下鑽 /
  // 跳轉。`regionId` 為 `null` 時 `RegionSummaryPopup` 的 `Modal` 即關閉。
  const activeSummaryTier: RegionSummaryTier = isDrilledIn ? 'district' : 'county';
  const activeSummaryRegionId = isDrilledIn ? selectedDistrict : openCountySummaryId;

  // 職缺總數一律取自職缺數資料（不受著色視角影響），比照既有
  // `RegionDetailPanel`/task 9.1 的既有慣例。
  const panelTotalJobCount = selectedDistrict
    ? (townJobCountValues.get(selectedDistrict) ?? 0)
    : (countyValues.get(openCountySummaryId ?? '') ?? 0);

  const handleCloseSummary = () => {
    if (activeSummaryTier === 'district') {
      setSelectedDistrict(null);
    } else {
      setOpenCountySummaryId(null);
    }
  };

  // 僅縣市層提供下鑽操作（Requirement 3.2）：`setSelectedCounty` 的副作用已
  // 一併清空 `openCountySummaryId`，這裡不需重複清空。
  const handleDrillDown = () => setSelectedCounty(openCountySummaryId);

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

      <LocationMapHeader />

      {locationGroupsQuery.isLoading ? (
        <RegionMapSkeleton />
      ) : locationGroupsQuery.isError ? (
        <RegionMapError onRetry={() => locationGroupsQuery.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
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
              selectedRegionId={isDrilledIn ? selectedDistrict : openCountySummaryId}
              onSelect={handleSelectRegion}
              mobileInitialFocusIds={isDrilledIn ? undefined : MOBILE_INITIAL_FOCUS_COUNTIES}
            />
          </div>

          <RegionSummaryPopup
            regionId={activeSummaryRegionId}
            displayName={activeSummaryRegionId ?? ''}
            tier={activeSummaryTier}
            totalJobCount={panelTotalJobCount}
            onClose={handleCloseSummary}
            onDrillDown={activeSummaryTier === 'county' ? handleDrillDown : undefined}
            parentCountyName={activeSummaryTier === 'district' ? (selectedCounty ?? undefined) : undefined}
            onReturnToCounty={activeSummaryTier === 'district' ? handleReturnToOverview : undefined}
          />
        </div>
      )}
    </div>
  );
}
