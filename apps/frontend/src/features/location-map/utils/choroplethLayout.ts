import { geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

/**
 * `RegionChoropleth` 的純幾何／標籤佈局邏輯（自該元件抽出，維持元件本身
 * 聚焦於渲染骨架，並符合 `frontend-standards.md` 的 200 行元件上限）。
 */
export interface RegionFeature {
  /** 縣市層：正規化縣市名；鄉鎮市區層：location_group.id 相容字串 */
  id: string;
  displayName: string;
  geometry: Geometry;
}

export interface RegionPath {
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

export const VIEWBOX_WIDTH = 800;
export const VIEWBOX_HEIGHT = 600;
export const FIT_SIZE_PADDING = 16;

// 標籤溢出處理：形狀夠大（外接框「較短邊」達門檻，避免細長形狀被誤判為
// 夠大）時，名稱+數字直接畫在形狀中心；放不下的地區不再隱藏標籤，改為把
// 標籤移到地圖左右兩側的海上（留白 gutter），再用一條細線連回形狀中心，
// 名稱資訊不因空間太小而消失。
export const MIN_SIZE_FOR_NAME_LABEL = 40;

// 海上標籤欄位：只要有任何地區的形狀放不下名稱標籤，就在 fitSize 時左右各
// 保留一段 gutter 當作「海面」，讓標籤有固定的落點；沒有任何小地區時不保留
// （地圖維持原本大小）。縣市層全台地圖本來就是「高度撐滿、寬度留白」，保留
// gutter 幾乎不影響地圖尺寸；鄉鎮市區層則以些微縮小換取小行政區名稱可讀。
export const OFFSHORE_GUTTER = 96;
// 同側海上標籤逐條垂直堆疊的最小間距（fontSize 10 的單行高度加一點呼吸空間）。
const OFFSHORE_LABEL_GAP = 14;
// 海上標籤欄位的上下邊界，避免第一條/最後一條貼齊 viewBox 邊緣被裁切。
const OFFSHORE_MARGIN_Y = 12;

/** 形狀是否小到放不下名稱標籤（此時名稱改畫在海上、以線連回形狀）。 */
export function isTooSmallForNameLabel(path: RegionPath): boolean {
  return Math.min(path.boundsWidth, path.boundsHeight) < MIN_SIZE_FOR_NAME_LABEL;
}

/** 多個形狀外接框合併後的整體邊界框（SVG 座標系）。 */
export interface MergedBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 合併多個 `RegionPath` 的外接框；空陣列回傳 `null`。 */
export function mergeBounds(paths: readonly RegionPath[]): MergedBounds | null {
  if (paths.length === 0) {
    return null;
  }
  return {
    minX: Math.min(...paths.map(p => p.boundsX0)),
    minY: Math.min(...paths.map(p => p.boundsY0)),
    maxX: Math.max(...paths.map(p => p.boundsX0 + p.boundsWidth)),
    maxY: Math.max(...paths.map(p => p.boundsY0 + p.boundsHeight)),
  };
}

/**
 * 純函式：將 `RegionFeature[]` 的幾何資料透過既定投影轉為 SVG path 字串。
 * `horizontalGutter` > 0 時，fitSize 的可用寬度左右各再內縮該值，為海上
 * 標籤保留固定落點（見 `OFFSHORE_GUTTER` 註解）。
 */
export function buildRegionPaths(
  features: RegionFeature[],
  horizontalGutter: number,
): RegionPath[] {
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
      VIEWBOX_WIDTH - (FIT_SIZE_PADDING + horizontalGutter) * 2,
      VIEWBOX_HEIGHT - FIT_SIZE_PADDING * 2,
    ],
    collection,
  );
  projection.translate([
    projection.translate()[0] + FIT_SIZE_PADDING + horizontalGutter,
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

/** 海上標籤的版位：標籤文字錨點與牽引線的兩端座標。 */
export interface OffshoreLabelPlacement {
  id: string;
  displayName: string;
  side: 'left' | 'right';
  /** 標籤文字的錨點 x（左側 textAnchor="end"、右側 "start"）。 */
  labelX: number;
  /** 標籤文字的基線 y（同側依序垂直堆疊，保證不互相重疊）。 */
  labelY: number;
  /** 牽引線靠標籤端的 x（與文字之間留一點空隙）。 */
  lineStartX: number;
  /** 牽引線指向的形狀中心點。 */
  centroid: [number, number];
}

/**
 * 把同一側的海上標籤由上而下堆疊：以各形狀中心點的 y 為理想位置，先由上往
 * 下推開重疊（保證間距 >= `OFFSHORE_LABEL_GAP`），再由下往上收回超出底部的
 * 部分。回傳與輸入同序（依中心點 y 排序）的標籤 y 座標。
 */
function layoutOffshoreColumn(sortedCentroidYs: readonly number[]): number[] {
  const ys = [...sortedCentroidYs];
  for (let i = 0; i < ys.length; i++) {
    const minY = i > 0 ? ys[i - 1] + OFFSHORE_LABEL_GAP : OFFSHORE_MARGIN_Y;
    ys[i] = Math.max(ys[i], minY);
  }
  for (let i = ys.length - 1; i >= 0; i--) {
    const maxY =
      i < ys.length - 1
        ? ys[i + 1] - OFFSHORE_LABEL_GAP
        : VIEWBOX_HEIGHT - OFFSHORE_MARGIN_Y;
    ys[i] = Math.min(ys[i], maxY);
  }
  return ys;
}

// 海上標籤與地圖邊緣的水平距離：貼著海岸外一小段，讓牽引線只需跨過「形狀
// 中心到海岸」的距離，而不是一路拉到 viewBox 邊緣（縣市層全台地圖為高度
// 撐滿、左右大量留白，若把標籤釘在 viewBox 邊緣，北部小縣市的線會橫跨半個
// 海面）。
const OFFSHORE_COLUMN_INSET = 12;
// 標籤的 viewBox 邊界保護：左側 end 錨點/右側 start 錨點外仍需容納整串
// 「名稱 數字」文字，預留約一個標籤的寬度避免被 svg 邊界裁切。
const OFFSHORE_COLUMN_MIN_EDGE = 80;
// 「該標籤緯度帶」的半高：計算標籤該貼齊的海岸位置時，只看與標籤 y 上下
// 這段範圍重疊的形狀。台灣本島輪廓上下寬窄差異大（嘉南平原最寬、北部
// 較窄），若一律貼齊整張地圖的左右極值，位於窄段的地區（例如新竹市）
// 牽引線仍會很長。
const OFFSHORE_COAST_BAND = 24;

/**
 * 計算所有「形狀放不下名稱標籤」地區的海上標籤版位：依形狀中心點在地圖左半
 * 或右半分成左右兩欄（往較近的海面移動），同欄內依中心點 y 排序後垂直
 * 堆疊；每個標籤的 x 貼齊「自身緯度帶內」的地圖邊緣（近似該緯度的海岸），
 * 讓牽引線維持適當長度。
 */
export function buildOffshoreLabels(paths: RegionPath[]): OffshoreLabelPlacement[] {
  const small = paths.filter(isTooSmallForNameLabel);
  const bounds = mergeBounds(paths);
  if (small.length === 0 || bounds === null) {
    return [];
  }

  // 標籤該貼齊的海岸位置：與 labelY 上下 OFFSHORE_COAST_BAND 範圍重疊的
  // 所有形狀外接框，取該側的極值。帶內至少包含該地區自己，不會為空。
  const coastEdgeAt = (labelY: number, side: 'left' | 'right'): number => {
    const bandPaths = paths.filter(
      p =>
        p.boundsY0 <= labelY + OFFSHORE_COAST_BAND &&
        p.boundsY0 + p.boundsHeight >= labelY - OFFSHORE_COAST_BAND,
    );
    return side === 'left'
      ? Math.min(...bandPaths.map(p => p.boundsX0))
      : Math.max(...bandPaths.map(p => p.boundsX0 + p.boundsWidth));
  };

  const mapMidX = (bounds.minX + bounds.maxX) / 2;
  const placements: OffshoreLabelPlacement[] = [];
  for (const side of ['left', 'right'] as const) {
    const column = small
      .filter(p =>
        side === 'left' ? p.centroid[0] < mapMidX : p.centroid[0] >= mapMidX,
      )
      .sort((a, b) => a.centroid[1] - b.centroid[1]);
    const ys = layoutOffshoreColumn(column.map(p => p.centroid[1]));

    column.forEach((p, i) => {
      const labelY = ys[i];
      const labelX =
        side === 'left'
          ? Math.max(
              coastEdgeAt(labelY, side) - OFFSHORE_COLUMN_INSET,
              OFFSHORE_COLUMN_MIN_EDGE,
            )
          : Math.min(
              coastEdgeAt(labelY, side) + OFFSHORE_COLUMN_INSET,
              VIEWBOX_WIDTH - OFFSHORE_COLUMN_MIN_EDGE,
            );

      placements.push({
        id: p.id,
        displayName: p.displayName,
        side,
        labelX,
        labelY,
        lineStartX: side === 'left' ? labelX + 3 : labelX - 3,
        centroid: p.centroid,
      });
    });
  }
  return placements;
}
