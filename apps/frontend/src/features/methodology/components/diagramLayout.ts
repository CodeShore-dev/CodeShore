// 關係圖（節點 + 箭頭）的通用版面引擎，與領域無關。
//
// 由「雲端與 CI/CD 架構」抽出共用，供其他關係圖區塊（如資料來源與爬蟲）重複使用。
// 領域差異以參數注入：groupOf 決定每個節點屬於哪個群組框、clusterRows 決定群組框
// 由上而下的流程列排列。座標單位 = px；窄螢幕由外層容器水平捲動。

export interface DiagramLayoutEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
}

export interface DiagramLayoutView {
  readonly tiers: readonly (readonly string[])[]; // 分層順序，每層為 node id 陣列
  readonly edges: readonly DiagramLayoutEdge[];
}

export const NODE_W = 184;
export const NODE_H = 66;
const INNER_COL_GAP = 24; // 同一群組、同一層的節點水平間距
const INNER_ROW_GAP = 40; // 群組框內，上下層之間的間距（給箭頭空間）
const CLUSTER_PAD_X = 14;
const CLUSTER_PAD_TOP = 20; // 群組標題與第一個節點之間的間距
const CLUSTER_PAD_BOTTOM = 14;
const CLUSTER_HEADER = 28;
const CLUSTER_GAP_X = 30; // 同一列、相鄰群組框的水平間距
const ROW_GAP_Y = 72; // 流程列（上游→下游）之間的垂直間距（加大，箭頭不重疊）
const PAD = 16;
const PORT_PAD = 22; // 連接點在節點邊上的內縮，避免擠在角落
const EDGE_STUB = 14; // 連線兩端與節點垂直的直線段長度（讓箭頭垂直進入節點）

export interface DiagramNodeBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly cx: number;
  readonly cy: number;
}

export interface DiagramBand {
  readonly group: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly ids: readonly string[];
}

export interface DiagramEdgePath {
  readonly key: string;
  readonly from: string; // 來源 node id，供「選取節點時點亮相連的邊」判斷
  readonly to: string; // 目標 node id
  readonly d: string;
  readonly label?: string;
  readonly lx: number; // 標籤錨點（曲線中段），供 hover 顯示說明用
  readonly ly: number;
}

export interface DiagramLayout {
  readonly width: number;
  readonly height: number;
  readonly bands: readonly DiagramBand[];
  readonly boxes: ReadonlyMap<string, DiagramNodeBox>;
  readonly edges: readonly DiagramEdgePath[];
}

interface ClusterPlan {
  readonly group: string;
  readonly rows: readonly (readonly string[])[]; // 群組框內依層分組的節點
  readonly w: number;
  readonly h: number;
}

const portPos = (x: number, count: number, index: number): number => {
  if (count <= 1) return x + NODE_W / 2;
  const usable = NODE_W - PORT_PAD * 2;
  return x + PORT_PAD + (usable * index) / (count - 1);
};

const portPosY = (y: number, count: number, index: number): number => {
  if (count <= 1) return y + NODE_H / 2;
  const usable = NODE_H - PORT_PAD * 2;
  return y + PORT_PAD + (usable * index) / (count - 1);
};

type Side = 'top' | 'bottom' | 'left' | 'right';

// 依兩節點相對位置決定連線從來源哪一邊離開、進入目標哪一邊。
// 必須與下方連線路徑的方向判斷使用相同門檻，確保連接點與實際路徑一致。
const sidesOf = (a: DiagramNodeBox, b: DiagramNodeBox): { from: Side; to: Side } => {
  if (b.y > a.y + NODE_H - 1) return { from: 'bottom', to: 'top' };
  if (a.y > b.y + NODE_H - 1) return { from: 'top', to: 'bottom' };
  if (b.cx > a.cx) return { from: 'right', to: 'left' };
  return { from: 'left', to: 'right' };
};

/**
 * 計算關係圖版面：群組框、節點座標與連線路徑。
 *
 * @param view        分層（tiers）與邊（edges）。
 * @param groupOf     由 node id 取得所屬群組鍵（決定落在哪個群組框）。
 * @param clusterRows 群組框由上而下的流程列排列；每列為群組鍵陣列（同列並排）。
 */
export function buildDiagramLayout(
  view: DiagramLayoutView,
  groupOf: (id: string) => string,
  clusterRows: readonly (readonly string[])[],
): DiagramLayout {
  const tierOf = (id: string): number => view.tiers.findIndex(tier => tier.includes(id));

  const byGroup = new Map<string, string[]>();
  for (const id of view.tiers.flat()) {
    const arr = byGroup.get(groupOf(id)) ?? [];
    arr.push(id);
    byGroup.set(groupOf(id), arr);
  }

  // 群組框內：依層（tier）分成上下列，同層節點並排。
  const planFor = (group: string): ClusterPlan => {
    const ids = byGroup.get(group) ?? [];
    const tiers = [...new Set(ids.map(tierOf))];
    const rows = tiers.map(t => ids.filter(id => tierOf(id) === t));
    const innerW = Math.max(...rows.map(r => r.length * NODE_W + (r.length - 1) * INNER_COL_GAP));
    return {
      group,
      rows,
      w: innerW + CLUSTER_PAD_X * 2,
      h: CLUSTER_HEADER + CLUSTER_PAD_TOP + rows.length * NODE_H + (rows.length - 1) * INNER_ROW_GAP + CLUSTER_PAD_BOTTOM,
    };
  };

  const planned = clusterRows.map(row => row.filter(g => byGroup.has(g)).map(planFor));

  const width =
    Math.max(
      ...planned.map(row => row.reduce((sum, c) => sum + c.w, 0) + Math.max(0, row.length - 1) * CLUSTER_GAP_X),
      0,
    ) +
    PAD * 2;

  const boxes = new Map<string, DiagramNodeBox>();
  const bands: DiagramBand[] = [];
  let y = PAD;
  for (const row of planned) {
    const rowW = row.reduce((sum, c) => sum + c.w, 0) + Math.max(0, row.length - 1) * CLUSTER_GAP_X;
    let x = (width - rowW) / 2;
    const rowH = Math.max(...row.map(c => c.h), 0);
    for (const cluster of row) {
      cluster.rows.forEach((ids, r) => {
        const rw = ids.length * NODE_W + (ids.length - 1) * INNER_COL_GAP;
        const startX = x + (cluster.w - rw) / 2;
        const ny = y + CLUSTER_HEADER + CLUSTER_PAD_TOP + r * (NODE_H + INNER_ROW_GAP);
        ids.forEach((id, j) => {
          const nx = startX + j * (NODE_W + INNER_COL_GAP);
          boxes.set(id, { id, x: nx, y: ny, cx: nx + NODE_W / 2, cy: ny + NODE_H / 2 });
        });
      });
      bands.push({
        group: cluster.group,
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

  // 連接點分散：同一節點同一邊上的所有連線（出邊與入邊一起計算）沿該邊平均散開，
  // 讓「從本節點出去」與「從別的節點進來」的線各佔不同位置、不重疊，也看得出來源／去向。
  interface PortReq {
    readonly edge: number; // view.edges 索引
    readonly role: 'from' | 'to';
    readonly sort: number; // 沿邊排序鍵：對方端點的 cx（上下邊）或 cy（左右邊）
  }
  const sidePorts = new Map<string, PortReq[]>(); // key = `${nodeId}:${side}`
  const pushPort = (nodeId: string, side: Side, req: PortReq): void => {
    const arr = sidePorts.get(`${nodeId}:${side}`) ?? [];
    arr.push(req);
    sidePorts.set(`${nodeId}:${side}`, arr);
  };
  view.edges.forEach((e, i) => {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) return;
    const { from, to } = sidesOf(a, b);
    const fromVertical = from === 'top' || from === 'bottom';
    const toVertical = to === 'top' || to === 'bottom';
    pushPort(e.from, from, { edge: i, role: 'from', sort: toVertical ? b.cx : b.cy });
    pushPort(e.to, to, { edge: i, role: 'to', sort: fromVertical ? a.cx : a.cy });
  });

  // 每條邊在來源側／目標側的連接點座標（上下邊存 x、左右邊存 y，依該邊方向取用）。
  const startPort = new Map<number, number>();
  const endPort = new Map<number, number>();
  for (const [key, reqs] of sidePorts) {
    const nodeId = key.slice(0, key.lastIndexOf(':'));
    const side = key.slice(key.lastIndexOf(':') + 1) as Side;
    const box = boxes.get(nodeId);
    if (!box) continue;
    const vertical = side === 'top' || side === 'bottom';
    reqs.sort((p, q) => p.sort - q.sort);
    reqs.forEach((req, k) => {
      const pos = vertical ? portPos(box.x, reqs.length, k) : portPosY(box.y, reqs.length, k);
      (req.role === 'from' ? startPort : endPort).set(req.edge, pos);
    });
  }

  // 連線在「離開來源」與「進入目標（箭頭端）」兩處各保留一段與節點邊垂直的直線
  // stub，中間以平滑曲線連接，使箭頭以垂直角度進入節點、不歪斜。
  const edges: DiagramEdgePath[] = view.edges.flatMap((edge, i) => {
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    if (!a || !b) return [];
    const key = `${edge.from}-${edge.to}-${edge.label ?? ''}`;
    let d: string;
    let lx: number;
    let ly: number;
    if (b.y > a.y + NODE_H - 1) {
      // 向下：垂直離開來源底邊、垂直進入目標頂邊
      const sx = startPort.get(i) ?? a.cx;
      const ex = endPort.get(i) ?? b.cx;
      const y0 = a.y + NODE_H;
      const y1 = b.y;
      const s0 = y0 + EDGE_STUB;
      const s1 = y1 - EDGE_STUB;
      const my = (s0 + s1) / 2;
      d = `M${sx},${y0} L${sx},${s0} C${sx},${my} ${ex},${my} ${ex},${s1} L${ex},${y1}`;
      lx = (sx + ex) / 2;
      ly = my;
    } else if (a.y > b.y + NODE_H - 1) {
      // 向上
      const sx = startPort.get(i) ?? a.cx;
      const ex = endPort.get(i) ?? b.cx;
      const y0 = a.y;
      const y1 = b.y + NODE_H;
      const s0 = y0 - EDGE_STUB;
      const s1 = y1 + EDGE_STUB;
      const my = (s0 + s1) / 2;
      d = `M${sx},${y0} L${sx},${s0} C${sx},${my} ${ex},${my} ${ex},${s1} L${ex},${y1}`;
      lx = (sx + ex) / 2;
      ly = my;
    } else if (b.cx > a.cx) {
      // 同列向右：水平離開來源右邊、水平進入目標左邊
      const sy = startPort.get(i) ?? a.cy;
      const ey = endPort.get(i) ?? b.cy;
      const x0 = a.x + NODE_W;
      const x1 = b.x;
      const s0 = x0 + EDGE_STUB;
      const s1 = x1 - EDGE_STUB;
      const mx = (s0 + s1) / 2;
      d = `M${x0},${sy} L${s0},${sy} C${mx},${sy} ${mx},${ey} ${s1},${ey} L${x1},${ey}`;
      lx = mx;
      // 同列節點間水平間距很窄，label 若擺在線上（節點中線高度）會被左右節點方塊蓋住；
      // 改置於節點列正上方的空白帶（a.y === b.y），確保看得到。
      ly = a.y - 9;
    } else {
      // 同列向左
      const sy = startPort.get(i) ?? a.cy;
      const ey = endPort.get(i) ?? b.cy;
      const x0 = a.x;
      const x1 = b.x + NODE_W;
      const s0 = x0 - EDGE_STUB;
      const s1 = x1 + EDGE_STUB;
      const mx = (s0 + s1) / 2;
      d = `M${x0},${sy} L${s0},${sy} C${mx},${sy} ${mx},${ey} ${s1},${ey} L${x1},${ey}`;
      lx = mx;
      // 同列節點間水平間距很窄，label 若擺在線上（節點中線高度）會被左右節點方塊蓋住；
      // 改置於節點列正上方的空白帶（a.y === b.y），確保看得到。
      ly = a.y - 9;
    }
    return [{ key, from: edge.from, to: edge.to, d, label: edge.label, lx, ly }];
  });

  return { width, height, bands, boxes, edges };
}
