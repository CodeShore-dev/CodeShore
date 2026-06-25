import type { ArchNode, ArchView } from '../content/cloudArchitecture';

// 版面常數（座標 = px）。節點以原始可讀尺寸排版；窄螢幕由外層容器水平捲動。
export const NODE_W = 184;
export const NODE_H = 66;
const GAP_X = 18;
const BAND_PAD_X = 14;
const BAND_PAD_Y = 14;
const BAND_HEADER = 26;
const BAND_GAP_Y = 52; // 區塊之間的垂直間距（加大，避免箭頭擠在一起）
const PAD = 16;

export interface ArchNodeBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
}

export interface ArchBand {
  readonly provider: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly ids: readonly string[];
}

export interface ArchEdgePath {
  readonly key: string;
  readonly d: string;
}

export interface ArchLayout {
  readonly width: number;
  readonly height: number;
  readonly bands: readonly ArchBand[];
  readonly boxes: ReadonlyMap<string, ArchNodeBox>;
  readonly edges: readonly ArchEdgePath[];
}

/**
 * 將一個視角的節點依「雲端供應商」分組成水平區塊（band），由上而下依流程順序排列，
 * 並算出每個節點的座標與每條關係邊的 SVG 路徑（同區塊內水平連線／跨區塊垂直連線）。
 */
export function buildArchLayout(
  view: ArchView,
  nodes: readonly ArchNode[],
): ArchLayout {
  const providerOf = (id: string): string =>
    nodes.find((n) => n.id === id)?.provider ?? 'shared';
  const tierOf = (id: string): number =>
    view.tiers.findIndex((tier) => tier.includes(id));

  const groups = new Map<string, string[]>();
  for (const id of view.tiers.flat()) {
    const arr = groups.get(providerOf(id)) ?? [];
    arr.push(id);
    groups.set(providerOf(id), arr);
  }

  const minTier = (provider: string): number =>
    Math.min(...(groups.get(provider) ?? []).map(tierOf));
  const order = [...groups.keys()].sort((a, b) => minTier(a) - minTier(b));

  const boxes = new Map<string, ArchNodeBox>();
  const bands: ArchBand[] = [];
  let y = PAD;
  let width = 0;

  for (const provider of order) {
    const ids = (groups.get(provider) ?? [])
      .slice()
      .sort((a, b) => tierOf(a) - tierOf(b));
    const innerW = ids.length * NODE_W + Math.max(0, ids.length - 1) * GAP_X;
    const bandW = innerW + BAND_PAD_X * 2;
    width = Math.max(width, bandW + PAD * 2);
    const bx = PAD;
    const by = y;
    ids.forEach((id, i) => {
      const x = bx + BAND_PAD_X + i * (NODE_W + GAP_X);
      const ny = by + BAND_HEADER + BAND_PAD_Y;
      boxes.set(id, { id, x, y: ny, cx: x + NODE_W / 2, cy: ny + NODE_H / 2 });
    });
    bands.push({
      provider,
      x: bx,
      y: by,
      w: bandW,
      h: BAND_HEADER + NODE_H + BAND_PAD_Y * 2,
      ids,
    });
    y = by + BAND_HEADER + NODE_H + BAND_PAD_Y * 2 + BAND_GAP_Y;
  }

  const height = y - BAND_GAP_Y + PAD;

  const edges: ArchEdgePath[] = [];
  for (const edge of view.edges) {
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    if (!a || !b) continue;
    const key = `${edge.from}-${edge.to}-${edge.label ?? ''}`;
    let d: string;
    if (providerOf(edge.from) === providerOf(edge.to)) {
      const adjacent = b.x > a.x && b.x - (a.x + NODE_W) <= GAP_X + 1;
      if (adjacent) {
        d = `M${a.x + NODE_W},${a.cy} L${b.x},${b.cy}`;
      } else {
        const yy = a.y + NODE_H;
        d = `M${a.cx},${yy} C${a.cx},${yy + 26} ${b.cx},${yy + 26} ${b.cx},${yy}`;
      }
    } else if (b.y > a.y) {
      const my = (a.y + NODE_H + b.y) / 2;
      d = `M${a.cx},${a.y + NODE_H} C${a.cx},${my} ${b.cx},${my} ${b.cx},${b.y}`;
    } else {
      const my = (a.y + (b.y + NODE_H)) / 2;
      d = `M${a.cx},${a.y} C${a.cx},${my} ${b.cx},${my} ${b.cx},${b.y + NODE_H}`;
    }
    edges.push({ key, d });
  }

  return { width, height, bands, boxes, edges };
}
