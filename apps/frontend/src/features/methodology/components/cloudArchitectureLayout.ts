import type { ArchNode, ArchView, ArchViewId } from '../content/cloudArchitecture';

// 版面常數（座標 = px）。節點原始可讀尺寸；窄螢幕由外層容器水平捲動。
export const NODE_W = 184;
export const NODE_H = 66;
const INNER_COL_GAP = 16; // 同一供應商、同一層的節點水平間距
const INNER_ROW_GAP = 30; // 供應商區塊內，上下層之間的間距（給箭頭空間）
const CLUSTER_PAD_X = 14;
const CLUSTER_PAD_BOTTOM = 14;
const CLUSTER_HEADER = 28;
const CLUSTER_GAP_X = 30; // 同一列、相鄰供應商區塊的水平間距
const ROW_GAP_Y = 72; // 流程列（上游→下游）之間的垂直間距（加大，箭頭不重疊）
const PAD = 16;
const PORT_PAD = 22; // 連接點在節點邊上的內縮，避免擠在角落
const EDGE_STUB = 14; // 連線兩端與節點垂直的直線段長度（讓箭頭垂直進入節點）

// 各視角的供應商區塊排列（由上而下的流程列；同一列的供應商並排）。
// 入口在上、並行的雲在中間並排、共用匯流在下 —— 箭頭只跨越列間的淨空，不會被節點擋住。
const CLUSTER_ROWS: Record<ArchViewId, readonly (readonly string[])[]> = {
  traffic: [['cloudflare'], ['aws', 'azure', 'gcp'], ['shared']],
  cicd: [['shared'], ['gcp', 'aws', 'azure']],
};

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

interface ClusterPlan {
  readonly provider: string;
  readonly rows: readonly (readonly string[])[]; // 區塊內依層分組的節點
  readonly w: number;
  readonly h: number;
}

const portPos = (x: number, count: number, index: number): number => {
  if (count <= 1) return x + NODE_W / 2;
  const usable = NODE_W - PORT_PAD * 2;
  return x + PORT_PAD + (usable * index) / (count - 1);
};

export function buildArchLayout(view: ArchView, nodes: readonly ArchNode[]): ArchLayout {
  const providerOf = (id: string): string => nodes.find(n => n.id === id)?.provider ?? 'shared';
  const tierOf = (id: string): number => view.tiers.findIndex(tier => tier.includes(id));

  const byProvider = new Map<string, string[]>();
  for (const id of view.tiers.flat()) {
    const arr = byProvider.get(providerOf(id)) ?? [];
    arr.push(id);
    byProvider.set(providerOf(id), arr);
  }

  // 區塊內：依層（tier）分成上下列，同層節點並排。
  const planFor = (provider: string): ClusterPlan => {
    const ids = byProvider.get(provider) ?? [];
    const tiers = [...new Set(ids.map(tierOf))].sort((a, b) => a - b);
    const rows = tiers.map(t => ids.filter(id => tierOf(id) === t).sort((a, b) => a.localeCompare(b)));
    const innerW = Math.max(...rows.map(r => r.length * NODE_W + (r.length - 1) * INNER_COL_GAP));
    return {
      provider,
      rows,
      w: innerW + CLUSTER_PAD_X * 2,
      h: CLUSTER_HEADER + rows.length * NODE_H + (rows.length - 1) * INNER_ROW_GAP + CLUSTER_PAD_BOTTOM,
    };
  };

  const clusterRows = (CLUSTER_ROWS[view.id] ?? []).map(row => row.filter(p => byProvider.has(p)).map(planFor));

  const width =
    Math.max(
      ...clusterRows.map(row => row.reduce((sum, c) => sum + c.w, 0) + Math.max(0, row.length - 1) * CLUSTER_GAP_X),
      0,
    ) +
    PAD * 2;

  const boxes = new Map<string, ArchNodeBox>();
  const bands: ArchBand[] = [];
  let y = PAD;
  for (const row of clusterRows) {
    const rowW = row.reduce((sum, c) => sum + c.w, 0) + Math.max(0, row.length - 1) * CLUSTER_GAP_X;
    let x = (width - rowW) / 2;
    const rowH = Math.max(...row.map(c => c.h), 0);
    for (const cluster of row) {
      cluster.rows.forEach((ids, r) => {
        const rw = ids.length * NODE_W + (ids.length - 1) * INNER_COL_GAP;
        const startX = x + (cluster.w - rw) / 2;
        const ny = y + CLUSTER_HEADER + r * (NODE_H + INNER_ROW_GAP);
        ids.forEach((id, j) => {
          const nx = startX + j * (NODE_W + INNER_COL_GAP);
          boxes.set(id, { id, x: nx, y: ny, cx: nx + NODE_W / 2, cy: ny + NODE_H / 2 });
        });
      });
      bands.push({
        provider: cluster.provider,
        x,
        y,
        w: cluster.w,
        h: cluster.h,
        ids: cluster.rows.flat(),
      });
      x += cluster.w + CLUSTER_GAP_X;
    }
    y += rowH + ROW_GAP_Y;
  }
  const height = y - ROW_GAP_Y + PAD;

  // 連接點分散：同一節點的多條出邊／入邊沿節點邊緣平均散開，避免重疊、看得出來源。
  const startX = new Map<number, number>();
  const endX = new Map<number, number>();
  const group = (pick: (e: { from: string; to: string }) => string) => {
    const m = new Map<string, number[]>();
    view.edges.forEach((e, i) => {
      const arr = m.get(pick(e)) ?? [];
      arr.push(i);
      m.set(pick(e), arr);
    });
    return m;
  };
  for (const [from, idxs] of group(e => e.from)) {
    const a = boxes.get(from);
    if (!a) continue;
    idxs.sort((i, j) => (boxes.get(view.edges[i].to)?.cx ?? 0) - (boxes.get(view.edges[j].to)?.cx ?? 0));
    idxs.forEach((ei, k) => startX.set(ei, portPos(a.x, idxs.length, k)));
  }
  for (const [to, idxs] of group(e => e.to)) {
    const b = boxes.get(to);
    if (!b) continue;
    idxs.sort((i, j) => (boxes.get(view.edges[i].from)?.cx ?? 0) - (boxes.get(view.edges[j].from)?.cx ?? 0));
    idxs.forEach((ei, k) => endX.set(ei, portPos(b.x, idxs.length, k)));
  }

  // 連線在「離開來源」與「進入目標（箭頭端）」兩處各保留一段與節點邊垂直的直線
  // stub，中間以平滑曲線連接，使箭頭以垂直角度進入節點、不歪斜。
  const edges: ArchEdgePath[] = view.edges.flatMap((edge, i) => {
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    if (!a || !b) return [];
    const key = `${edge.from}-${edge.to}-${edge.label ?? ''}`;
    const sx = startX.get(i) ?? a.cx;
    const ex = endX.get(i) ?? b.cx;
    let d: string;
    if (b.y > a.y + NODE_H - 1) {
      // 向下：垂直離開來源底邊、垂直進入目標頂邊
      const y0 = a.y + NODE_H;
      const y1 = b.y;
      const s0 = y0 + EDGE_STUB;
      const s1 = y1 - EDGE_STUB;
      const my = (s0 + s1) / 2;
      d = `M${sx},${y0} L${sx},${s0} C${sx},${my} ${ex},${my} ${ex},${s1} L${ex},${y1}`;
    } else if (a.y > b.y + NODE_H - 1) {
      // 向上
      const y0 = a.y;
      const y1 = b.y + NODE_H;
      const s0 = y0 - EDGE_STUB;
      const s1 = y1 + EDGE_STUB;
      const my = (s0 + s1) / 2;
      d = `M${sx},${y0} L${sx},${s0} C${sx},${my} ${ex},${my} ${ex},${s1} L${ex},${y1}`;
    } else if (b.cx > a.cx) {
      // 同列向右：水平離開來源右邊、水平進入目標左邊
      const x0 = a.x + NODE_W;
      const y0 = a.y + NODE_H / 2;
      const x1 = b.x;
      const y1 = b.y + NODE_H / 2;
      const s0 = x0 + EDGE_STUB;
      const s1 = x1 - EDGE_STUB;
      const mx = (s0 + s1) / 2;
      d = `M${x0},${y0} L${s0},${y0} C${mx},${y0} ${mx},${y1} ${s1},${y1} L${x1},${y1}`;
    } else {
      // 同列向左
      const x0 = a.x;
      const y0 = a.y + NODE_H / 2;
      const x1 = b.x + NODE_W;
      const y1 = b.y + NODE_H / 2;
      const s0 = x0 - EDGE_STUB;
      const s1 = x1 + EDGE_STUB;
      const mx = (s0 + s1) / 2;
      d = `M${x0},${y0} L${s0},${y0} C${mx},${y0} ${mx},${y1} ${s1},${y1} L${x1},${y1}`;
    }
    return [{ key, d }];
  });

  return { width, height, bands, boxes, edges };
}
