import { useMemo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

import { getRegionColor } from '../utils/colorScale';

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
}

interface RegionPath {
  id: string;
  displayName: string;
  d: string;
  /** SVG 座標系下的形狀中心點，用來放置永遠可見的標籤文字（不依賴 hover）。 */
  centroid: [number, number];
  /** 形狀外接框的寬高（SVG 座標系），用來判斷標籤文字是否會溢出形狀。 */
  boundsWidth: number;
  boundsHeight: number;
}

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 600;
const FIT_SIZE_PADDING = 16;

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
}: RegionChoroplethProps) {
  const paths = useMemo(() => buildRegionPaths(features), [features]);

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      role="img"
      aria-label="地區職缺分布地圖"
      className="h-auto w-full"
    >
      {paths.map(({ id, displayName, d, centroid, boundsWidth, boundsHeight }) => {
        const value = valueByRegionId.get(id) ?? 0;
        const fill = getRegionColor(value, maxValue);
        const isSelected = id === selectedRegionId;
        const [cx, cy] = centroid;

        // 形狀太小時標籤文字必然溢出，寧可不顯示（點擊、hover title 仍在，
        // 資訊並未消失，只是不再永遠佔用畫面）；中等大小只顯示數字，因為
        // 單一數字比「名稱+數字」窄很多，較不易溢出。
        const shortestSide = Math.min(boundsWidth, boundsHeight);
        const showLabel = shortestSide >= MIN_SIZE_FOR_ANY_LABEL;
        const showName = shortestSide >= MIN_SIZE_FOR_NAME_LABEL;
        const fontSize = showName ? 10 : 8;

        return (
          <g key={id}>
            <path
              data-region-id={id}
              d={d}
              fill={fill}
              stroke={isSelected ? '#003d92' : '#ffffff'}
              strokeWidth={isSelected ? 2 : 0.5}
              role="button"
              aria-label={`${displayName}：${value} 筆職缺`}
              className="cursor-pointer transition-[fill] hover:opacity-80"
              onClick={() => onSelect(id)}
            >
              <title>{`${displayName}：${value} 筆職缺`}</title>
            </path>
            {/* 名稱／職缺數直接畫在 SVG 上（不只是 hover 才顯示的
                <title>），白色描邊確保在淺色與深色著色上都看得清楚；
                pointer-events-none 讓點擊仍穿透到底下的 path。形狀太小時
                改為只顯示數字或完全隱藏，避免文字溢出形狀外。 */}
            {showLabel && (
              <text
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
            )}
          </g>
        );
      })}
    </svg>
  );
}
