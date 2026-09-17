import type {
  OffshoreLabelPlacement,
  RegionPath,
} from '../utils/choroplethLayout';

/**
 * `RegionChoropleth` 的標籤子元件（自該元件抽出，維持其在
 * `frontend-standards.md` 的 200 行元件上限內）。
 */

/** 形狀內的永遠可見標籤（名稱+數字；0 筆職缺只顯示名稱，不畫「0」）。 */
export function InlineLabel({
  path,
  value,
}: {
  path: RegionPath;
  value: number;
}) {
  const [cx, cy] = path.centroid;

  // 名稱／職缺數直接畫在 SVG 上（不只是 hover 才顯示的 <title>），白色描邊
  // 確保在淺色與深色著色上都看得清楚；pointer-events-none 讓點擊仍穿透到
  // 底下的 path。
  return (
    <text
      data-region-id={path.id}
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
      {value > 0 ? (
        <>
          <tspan x={cx} dy="-2">
            {path.displayName}
          </tspan>
          <tspan x={cx} dy={12}>
            {value}
          </tspan>
        </>
      ) : (
        path.displayName
      )}
    </text>
  );
}

/**
 * 海上標籤：0 筆職缺只顯示名稱（與形狀內標籤的規則一致，不畫「0」）；有
 * 職缺則顯示「名稱 數字」。有職缺的地區形狀太小很難點中，因此標籤本身也
 * 可點選，行為等同點擊形狀。
 */
export function OffshoreLabel({
  placement,
  value,
  onSelect,
}: {
  placement: OffshoreLabelPlacement;
  value: number;
  onSelect: (regionId: string) => void;
}) {
  const { id, displayName, side, labelX, labelY } = placement;
  const isEmpty = value <= 0;

  return (
    <text
      data-region-id={id}
      data-testid="offshore-label"
      x={labelX}
      y={labelY}
      textAnchor={side === 'left' ? 'end' : 'start'}
      className={
        isEmpty
          ? 'pointer-events-none font-bold select-none'
          : 'cursor-pointer font-bold select-none'
      }
      fontSize={10}
      fill="#001f2a"
      stroke="#ffffff"
      strokeWidth={3}
      paintOrder="stroke"
      onClick={isEmpty ? undefined : () => onSelect(id)}
    >
      {isEmpty ? displayName : `${displayName} ${value}`}
    </text>
  );
}
