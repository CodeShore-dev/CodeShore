import { useEffect, useMemo, useRef } from 'react';

import { getRegionColor } from '../utils/colorScale';
import {
  buildOffshoreLabels,
  buildRegionPaths,
  isTooSmallForNameLabel,
  mergeBounds,
  OFFSHORE_GUTTER,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  type RegionFeature,
} from '../utils/choroplethLayout';
import { useIsMobile } from '../hooks/useIsMobile';
import { InlineLabel, OffshoreLabel } from './RegionMapLabels';

/**
 * 展示型元件（task 6.1，design.md「RegionChoropleth（Props Contract）」）。
 *
 * 縣市層與鄉鎮市區層共用同一元件：`features`/`valueByRegionId` 完全由呼叫端
 * （`LocationMapPage`／`useRegionValueMaps`）算好傳入，本元件不呼叫任何查詢
 * 或聚合邏輯，也不對 `features` 的內容（縣市或鄉鎮市區）做任何假設。
 * 幾何投影與海上標籤佈局的純函式抽在 `utils/choroplethLayout.ts`。
 */
export type { RegionFeature } from '../utils/choroplethLayout';

export interface RegionChoroplethProps {
  features: RegionFeature[];
  /** 缺席 = 0（Requirement 2.2, 3.3, 4.4） */
  valueByRegionId: ReadonlyMap<string, number>;
  maxValue: number;
  selectedRegionId: string | null;
  onSelect: (regionId: string) => void;
  /**
   * 行動裝置版面下（寬度低於 `useIsMobile` 斷點），地圖一律放大並允許
   * 使用者拖曳/滑動移動視角；本清單指定初始畫面聚焦的地區 id（例如北北基
   * 三縣市），未提供或清單內的 id 都不在目前 `features` 中（例如已下鑽到
   * 某縣市）時，初始視角改為整張地圖的中心。桌機寬度下維持「地圖縮放至
   * 容器寬度」的既有行為，不會出現可捲動的放大版面。
   */
  mobileInitialFocusIds?: readonly string[];
}

// 行動裝置初始聚焦視角：把整張地圖放大到容器寬度的幾倍，讓 `mobileInitialFocusIds`
// 指定的地區（例如北北基）在初次進入時已大致填滿螢幕，其餘地區則需使用者
// 自行拖曳/滑動捲動容器才看得到——放大倍率越高，聚焦區域越大、可捲動範圍
// 也越大，3 倍是在「北北基夠大看得清楚」與「捲動範圍不會大到難以找到其他
// 縣市」之間取的折衷值。
const MOBILE_ZOOM_FACTOR = 2;
const MOBILE_MAP_MAX_HEIGHT = 480;

export function RegionChoropleth({
  features,
  valueByRegionId,
  maxValue,
  selectedRegionId,
  onSelect,
  mobileInitialFocusIds,
}: RegionChoroplethProps) {
  // 兩段式建構：先以全寬投影，若沒有任何地區小到放不下名稱標籤，就維持原本
  // 的滿版地圖；只要有，改以左右保留海上標籤 gutter 的投影重算（縮小後可能
  // 讓更多地區跌破門檻，因此海上標籤名單一律以縮小後的最終幾何為準）。
  const paths = useMemo(() => {
    const fullWidth = buildRegionPaths(features, 0);
    if (!fullWidth.some(isTooSmallForNameLabel)) {
      return fullWidth;
    }
    return buildRegionPaths(features, OFFSHORE_GUTTER);
  }, [features]);

  const offshoreLabels = useMemo(() => buildOffshoreLabels(paths), [paths]);
  const offshoreIds = useMemo(
    () => new Set(offshoreLabels.map(l => l.id)),
    [offshoreLabels],
  );
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 行動裝置版面下的初始捲動目標：優先用 mobileInitialFocusIds 指定的地區
  // （例如北北基）合併邊界框的中心點；找不到任何一個 id（例如已下鑽到某
  // 縣市、features 不含北北基）時退回整張地圖的中心——下鑽後的鄉鎮市區層
  // 同樣需要放大到適合閱讀/點擊的大小，再讓使用者拖曳移動視角。
  const mobileScrollCenter = useMemo(() => {
    const idSet = new Set(mobileInitialFocusIds ?? []);
    const focusPaths = paths.filter(p => idSet.has(p.id));
    const bounds = mergeBounds(focusPaths.length > 0 ? focusPaths : paths);
    if (bounds === null) return null;

    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }, [paths, mobileInitialFocusIds]);

  const useMobileZoom = isMobile && mobileScrollCenter !== null;

  // 掛載（或聚焦地區改變，例如下鑽/返回總覽切換了 features）時，把捲動容器
  // 捲到初始目標的中心點：縣市層先看到北北基、下鑽後置中該縣市的鄉鎮市區，
  // 其餘地區則由使用者自行拖曳/滑動捲動容器查看。
  useEffect(() => {
    if (!useMobileZoom || !mobileScrollCenter) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    el.scrollLeft = mobileScrollCenter.x * MOBILE_ZOOM_FACTOR - el.clientWidth / 2;
    el.scrollTop = mobileScrollCenter.y * MOBILE_ZOOM_FACTOR - el.clientHeight / 2;
  }, [useMobileZoom, mobileScrollCenter]);

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
      {paths.map(({ id, displayName, d }) => {
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
      {/* 牽引線畫在所有 path 之後、標籤文字之前：線壓在形狀上但不會蓋住
          任何標籤文字。 */}
      {offshoreLabels.map(({ id, lineStartX, labelY, centroid }) => (
        <line
          key={id}
          data-testid="offshore-leader"
          data-region-id={id}
          x1={lineStartX}
          y1={labelY - 3}
          x2={centroid[0]}
          y2={centroid[1]}
          stroke="#9398a6"
          strokeWidth={0.75}
        />
      ))}
      {/* 形狀放不下名稱標籤的地區改畫海上標籤，形狀內不再畫任何文字。 */}
      {paths.map(path =>
        offshoreIds.has(path.id) ? null : (
          <InlineLabel
            key={path.id}
            path={path}
            value={valueByRegionId.get(path.id) ?? 0}
          />
        ),
      )}
      {offshoreLabels.map(placement => (
        <OffshoreLabel
          key={placement.id}
          placement={placement}
          value={valueByRegionId.get(placement.id) ?? 0}
          onSelect={onSelect}
        />
      ))}
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
