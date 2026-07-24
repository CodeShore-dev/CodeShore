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
}

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 600;
const FIT_SIZE_PADDING = 16;

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

    return {
      id: f.id,
      displayName: f.displayName,
      d: pathGenerator(feature) ?? '',
      centroid: pathGenerator.centroid(feature),
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
      {paths.map(({ id, displayName, d, centroid }) => {
        const value = valueByRegionId.get(id) ?? 0;
        const fill = getRegionColor(value, maxValue);
        const isSelected = id === selectedRegionId;
        const [cx, cy] = centroid;

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
            {/* 名稱／職缺數一律直接畫在 SVG 上（不只是 hover 才顯示的
                <title>），白色描邊確保在淺色與深色著色上都看得清楚；
                pointer-events-none 讓點擊仍穿透到底下的 path。 */}
            <text
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
              <tspan x={cx} dy="-2">
                {displayName}
              </tspan>
              <tspan x={cx} dy="12">
                {value}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
