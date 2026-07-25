import { useEffect, useMemo, useRef } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

import { getRegionColor } from '../utils/colorScale';
import { useIsMobile } from '../hooks/useIsMobile';

/**
 * 展示型元件（task 6.1，design.md「RegionChoropleth（Props Contract）」）。
 *
 * 縣市層與鄉鎮市區層共用同一元件：`features`/`valueByRegionId` 完全由呼叫端
 * （`LocationMapPage`／`useRegionValueMaps`）算好傳入，本元件不呼叫任何查詢
 * 或聚合邏輯，也不對 `features` 的內容（縣市或鄉鎮市區）做任何假設。
 */
export interface RegionFeature {
  /** 縣市層：正規化縣市名；鄉鎮市區層：location_group.id 相容字串 */
  id: string;
  displayName: string;
  geometry: Geometry;
}

export interface RegionChoroplethProps {
  features: RegionFeature[];
  /** 缺席 = 0（Requirement 2.2, 3.3, 4.4） */
  valueByRegionId: ReadonlyMap<string, number>;
  maxValue: number;
  selectedRegionId: string | null;
  onSelect: (regionId: string) => void;
  /**
   * 行動裝置版面下，初始畫面聚焦、並可讓使用者拖曳/滑動查看其餘地區的地區
   * id 清單（例如北北基三縣市）。僅在寬度低於行動裝置斷點（`useIsMobile`）
   * 時生效；未提供、清單為空，或桌機寬度下，維持原本「地圖縮放至容器寬度」
   * 的既有行為，不會出現可捲動的放大版面。
   */
  mobileInitialFocusIds?: readonly string[];
}

interface RegionPath {
  id: string;
  displayName: string;
  d: string;
  /** SVG 座標系下的形狀中心點，用來放置永遠可見的標籤文字（不依賴 hover）。 */
  centroid: [number, number];
  /** 形狀外接框左上角座標（SVG 座標系），用來計算多個地區合併後的邊界框。 */
  boundsX0: number;
  boundsY0: number;
  /** 形狀外接框的寬高（SVG 座標系），用來判斷標籤文字是否會溢出形狀。 */
  boundsWidth: number;
  boundsHeight: number;
}

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 600;
const FIT_SIZE_PADDING = 16;

// 行動裝置初始聚焦視角：把整張地圖放大到容器寬度的幾倍，讓 `mobileInitialFocusIds`
// 指定的地區（例如北北基）在初次進入時已大致填滿螢幕，其餘地區則需使用者
// 自行拖曳/滑動捲動容器才看得到——放大倍率越高，聚焦區域越大、可捲動範圍
// 也越大，3 倍是在「北北基夠大看得清楚」與「捲動範圍不會大到難以找到其他
// 縣市」之間取的折衷值。
const MOBILE_ZOOM_FACTOR = 3;
const MOBILE_MAP_MAX_HEIGHT = 480;

// 標籤溢出處理：形狀太小時全部隱藏文字（連數字都會超出，硬塞只會更雜亂），
// 中等大小只顯示數字（單一數字比「名稱+數字」窄很多，多數情況能塞進去），
// 夠大才顯示名稱+數字兩行。門檻取自形狀外接框「較短邊」，避免細長形狀被
// 誤判為夠大。
const MIN_SIZE_FOR_ANY_LABEL = 14;
const MIN_SIZE_FOR_NAME_LABEL = 40;

/**
 * 純函式：將單一 `RegionFeature` 的幾何資料透過既定投影轉為 SVG path 字串。
 * 抽出成獨立函式（而非 inline 在 render 內），維持元件本身聚焦於渲染骨架。
 */
function buildRegionPaths(features: RegionFeature[]): RegionPath[] {
  if (features.length === 0) {
    return [];
  }

  const collection: FeatureCollection<Geometry, Record<string, never>> = {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature',
      properties: {},
      geometry: f.geometry,
    })),
  };

  const projection = geoMercator().fitSize(
    [
      VIEWBOX_WIDTH - FIT_SIZE_PADDING * 2,
      VIEWBOX_HEIGHT - FIT_SIZE_PADDING * 2,
    ],
    collection,
  );
  projection.translate([
    projection.translate()[0] + FIT_SIZE_PADDING,
    projection.translate()[1] + FIT_SIZE_PADDING,
  ]);

  const pathGenerator = geoPath(projection);

  return features.map(f => {
    const feature: Feature<Geometry> = {
      type: 'Feature',
      properties: {},
      geometry: f.geometry,
    };

    const [[x0, y0], [x1, y1]] = pathGenerator.bounds(feature);

    return {
      id: f.id,
      displayName: f.displayName,
      d: pathGenerator(feature) ?? '',
      centroid: pathGenerator.centroid(feature),
      boundsX0: x0,
      boundsY0: y0,
      boundsWidth: x1 - x0,
      boundsHeight: y1 - y0,
    };
  });
}

export function RegionChoropleth({
  features,
  valueByRegionId,
  maxValue,
  selectedRegionId,
  onSelect,
  mobileInitialFocusIds,
}: RegionChoroplethProps) {
  const paths = useMemo(() => buildRegionPaths(features), [features]);
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 把 mobileInitialFocusIds 指定的地區（例如北北基）合併成一個邊界框，
  // 取其中心點作為行動裝置版面下的初始捲動目標；找不到任何一個 id（例如
  // 目前已下鑽到其他縣市、features 不含北北基）時視為不啟用。
  const mobileFocusCenter = useMemo(() => {
    if (!mobileInitialFocusIds || mobileInitialFocusIds.length === 0) return null;

    const idSet = new Set(mobileInitialFocusIds);
    const focusPaths = paths.filter(p => idSet.has(p.id));
    if (focusPaths.length === 0) return null;

    const minX = Math.min(...focusPaths.map(p => p.boundsX0));
    const minY = Math.min(...focusPaths.map(p => p.boundsY0));
    const maxX = Math.max(...focusPaths.map(p => p.boundsX0 + p.boundsWidth));
    const maxY = Math.max(...focusPaths.map(p => p.boundsY0 + p.boundsHeight));

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }, [paths, mobileInitialFocusIds]);

  const useMobileZoom = isMobile && mobileFocusCenter !== null;

  // 掛載（或聚焦地區改變，例如下鑽/返回總覽切換了 features）時，把捲動容器
  // 捲到聚焦地區的中心點，讓使用者一進畫面就先看到北北基，其餘地區則需自行
  // 拖曳/滑動捲動容器查看。
  useEffect(() => {
    if (!useMobileZoom || !mobileFocusCenter) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    el.scrollLeft = mobileFocusCenter.x * MOBILE_ZOOM_FACTOR - el.clientWidth / 2;
    el.scrollTop = mobileFocusCenter.y * MOBILE_ZOOM_FACTOR - el.clientHeight / 2;
  }, [useMobileZoom, mobileFocusCenter]);

  const svg = (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      role="img"
      aria-label="地區職缺分布地圖"
      width={useMobileZoom ? VIEWBOX_WIDTH * MOBILE_ZOOM_FACTOR : undefined}
      height={useMobileZoom ? VIEWBOX_HEIGHT * MOBILE_ZOOM_FACTOR : undefined}
      className={useMobileZoom ? undefined : 'h-auto w-full'}
    >
      {/* 先畫完所有 path，標籤文字一律留到第二輪、在 SVG 文件順序中排在
          全部 path 之後才畫——SVG 依文件順序疊圖，較晚出現的元素蓋在較早
          的上面。若文字跟自己的 path 綁在同一個 <g> 裡逐一畫，鄰近、較晚
          畫的其他縣市/鄉鎮 path 仍可能蓋住前一個形狀溢出到它範圍內的文字；
          把文字整批移到最後一輪，就能確保標籤永遠在最上層、不被任何 path
          蓋住/裁切。 */}
      {paths.map(({ id, displayName, d, centroid }) => {
        const value = valueByRegionId.get(id) ?? 0;
        const isEmpty = value <= 0;
        const fill = getRegionColor(value, maxValue);
        const isSelected = id === selectedRegionId;

        // 0 筆職缺的地區反灰、不可點選：沒有職缺可看，點進去也只會落在
        // 「查無資料」的地區摘要，不如直接讓地圖上就看得出「這裡沒有」。
        return (
          <path
            key={id}
            data-region-id={id}
            d={d}
            fill={fill}
            stroke={isSelected ? '#003d92' : '#ffffff'}
            strokeWidth={isSelected ? 2 : 0.5}
            role={isEmpty ? undefined : 'button'}
            aria-label={`${displayName}：${value} 筆職缺`}
            className={
              isEmpty
                ? 'transition-[fill]'
                : 'cursor-pointer transition-[fill] hover:opacity-80'
            }
            onClick={isEmpty ? undefined : () => onSelect(id)}
          >
            <title>{`${displayName}：${value} 筆職缺`}</title>
          </path>
        );
      })}
      {paths.map(({ id, displayName, centroid, boundsWidth, boundsHeight }) => {
        const value = valueByRegionId.get(id) ?? 0;
        const isEmpty = value <= 0;
        const [cx, cy] = centroid;

        const shortestSide = Math.min(boundsWidth, boundsHeight);
        const showName = shortestSide >= MIN_SIZE_FOR_NAME_LABEL;

        if (isEmpty) {
          // 0 筆職缺的地區已反灰、不可點選：不顯示「0」這個數字（沒有數字
          // 可看），但地區名稱仍保留，讓使用者在地圖上仍能辨識這是哪個
          // 縣市/鄉鎮市區；形狀太小放不下名稱時才完全不畫（hover 仍看得到
          // <title> 說明）。
          if (!showName) return null;

          return (
            <text
              key={id}
              data-region-id={id}
              x={cx}
              y={cy}
              textAnchor="middle"
              className="pointer-events-none font-bold select-none"
              fontSize={10}
              fill="#001f2a"
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {displayName}
            </text>
          );
        }

        // 形狀太小時標籤文字必然溢出，寧可不顯示（點擊、hover title 仍在，
        // 資訊並未消失，只是不再永遠佔用畫面）；中等大小只顯示數字，因為
        // 單一數字比「名稱+數字」窄很多，較不易溢出。
        const showLabel = shortestSide >= MIN_SIZE_FOR_ANY_LABEL;
        const fontSize = showName ? 10 : 8;

        if (!showLabel) return null;

        return (
          // 名稱／職缺數直接畫在 SVG 上（不只是 hover 才顯示的 <title>），
          // 白色描邊確保在淺色與深色著色上都看得清楚；pointer-events-none
          // 讓點擊仍穿透到底下的 path。形狀太小時改為只顯示數字或完全
          // 隱藏，避免文字溢出形狀外。
          <text
            key={id}
            data-region-id={id}
            x={cx}
            y={cy}
            textAnchor="middle"
            className="pointer-events-none font-bold select-none"
            fontSize={fontSize}
            fill="#001f2a"
            stroke="#ffffff"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {showName && (
              <tspan x={cx} dy="-2">
                {displayName}
              </tspan>
            )}
            <tspan x={cx} dy={showName ? 12 : 0}>
              {value}
            </tspan>
          </text>
        );
      })}
    </svg>
  );

  if (!useMobileZoom) {
    return svg;
  }

  return (
    <div
      ref={scrollContainerRef}
      data-testid="region-map-mobile-scroll"
      className="max-w-full overflow-auto overscroll-contain"
      style={{ maxHeight: MOBILE_MAP_MAX_HEIGHT }}
    >
      {svg}
    </div>
  );
}
