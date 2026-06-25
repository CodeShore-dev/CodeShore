import type {
  ArchNode,
  ArchView,
  NodeStatus,
} from '../content/cloudArchitecture';

export interface CloudArchitectureDiagramProps {
  readonly view: ArchView;
  readonly nodes: readonly ArchNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

// 狀態 → 中文語意 + 視覺色（硬編色票；不靠顏色單獨表意，另在 aria-label 帶語意）。
const STATUS_META: Record<
  NodeStatus,
  { readonly label: string; readonly dot: string; readonly ring: string }
> = {
  active: { label: '目前主力', dot: 'bg-[#003d92]', ring: 'focus-visible:ring-[#003d92]' },
  alternative: { label: '可切換備選', dot: 'bg-[#fd7700]', ring: 'focus-visible:ring-[#fd7700]' },
  backup: { label: '備援', dot: 'bg-[#434653]', ring: 'focus-visible:ring-[#434653]' },
  shared: { label: '共用', dot: 'bg-[#1654b9]', ring: 'focus-visible:ring-[#1654b9]' },
};

// 版面常數（座標 = px）。圖以原始可讀尺寸繪製；窄螢幕由外層容器水平捲動
// （不撐破頁面版面），桌機寬度可完整容納。
const COL_W = 128;
const COL_GAP = 18;
const NODE_H = 56;
const ROW_GAP = 46;
const PAD = 14;
const ROW_PITCH = NODE_H + ROW_GAP;

interface NodePos {
  readonly x: number;
  readonly y: number;
  readonly cx: number;
}

/**
 * 雲端架構關係圖（單一視角）：Mermaid 風格的「節點 + 箭頭連線」自上而下呈現各服務
 * 之間的關係，一目了然。採疊層繪製——底層 SVG 只畫箭頭連線，上層為一般 HTML 節點
 * 按鈕（滑鼠／觸控／鍵盤皆可，點擊看詳情）。整張圖以原始可讀尺寸排版，外層容器在
 * 窄螢幕水平捲動，頁面版面不破；文字等價內容由 CloudArchitectureSummary 提供。
 */
export function CloudArchitectureDiagram({
  view,
  nodes,
  selectedNodeId,
  onSelectNode,
}: CloudArchitectureDiagramProps) {
  const nodeOf = (id: string): ArchNode | undefined =>
    nodes.find((node) => node.id === id);

  const tierWidth = (count: number): number =>
    count * COL_W + Math.max(0, count - 1) * COL_GAP;

  const maxTierWidth = Math.max(...view.tiers.map((tier) => tierWidth(tier.length)));
  const width = maxTierWidth + PAD * 2;
  const height =
    PAD * 2 + view.tiers.length * NODE_H + (view.tiers.length - 1) * ROW_GAP;

  const pos = new Map<string, NodePos>();
  view.tiers.forEach((tier, tierIndex) => {
    const startX = (width - tierWidth(tier.length)) / 2;
    const y = PAD + tierIndex * ROW_PITCH;
    tier.forEach((id, i) => {
      const x = startX + i * (COL_W + COL_GAP);
      pos.set(id, { x, y, cx: x + COL_W / 2 });
    });
  });

  const edgePath = (fromId: string, toId: string): string | null => {
    const s = pos.get(fromId);
    const d = pos.get(toId);
    if (!s || !d) return null;
    const y1 = s.y + NODE_H;
    const y2 = d.y;
    const midY = (y1 + y2) / 2;
    return `M${s.cx},${y1} C${s.cx},${midY} ${d.cx},${midY} ${d.cx},${y2}`;
  };

  const renderNode = (node: ArchNode, p: NodePos) => {
    const meta = STATUS_META[node.status];
    const style = { left: p.x, top: p.y, width: COL_W, height: NODE_H } as const;
    const inner = (
      <span className="flex h-full w-full items-center gap-1.5 px-2">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
        />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[12px] font-bold text-[#001f2a]">
            {node.label}
          </span>
          <span className="block text-[10px] text-[#434653]">{meta.label}</span>
        </span>
      </span>
    );
    if (!node.interactive) {
      return (
        <div
          key={node.id}
          style={style}
          className="absolute rounded-lg border border-[#c3c6d5] bg-white"
        >
          {inner}
        </div>
      );
    }
    const selected = selectedNodeId === node.id;
    return (
      <button
        key={node.id}
        type="button"
        style={style}
        aria-pressed={selected}
        aria-label={`${node.label} — ${meta.label}`}
        onClick={() => onSelectNode(node.id)}
        className={`absolute rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 ${meta.ring} ${
          selected
            ? 'border-[#003d92] bg-[#d9f2ff]'
            : 'border-[#c3c6d5] bg-white hover:bg-[#f4faff]'
        }`}
      >
        {inner}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={`雲端架構關係圖：${view.title}`}
      className="space-y-2"
    >
      <div
        data-testid="arch-scroll"
        className="max-w-full overflow-x-auto rounded-xl border border-[#c3c6d5] bg-[#f4faff] p-3"
      >
        <div
          className="relative"
          style={{ width, height }}
          data-testid="arch-canvas"
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            className="absolute inset-0"
          >
            <defs>
              <marker
                id="arch-arrow"
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="#94a0b4" />
              </marker>
            </defs>
            {view.edges.map((edge) => {
              const d = edgePath(edge.from, edge.to);
              if (!d) return null;
              return (
                <path
                  key={`${edge.from}-${edge.to}-${edge.label ?? ''}`}
                  data-edge
                  d={d}
                  fill="none"
                  stroke="#94a0b4"
                  strokeWidth={1.5}
                  markerEnd="url(#arch-arrow)"
                >
                  {edge.label ? <title>{edge.label}</title> : null}
                </path>
              );
            })}
          </svg>
          {view.tiers.flat().map((id) => {
            const node = nodeOf(id);
            const p = pos.get(id);
            if (!node || !p) return null;
            return renderNode(node, p);
          })}
        </div>
      </div>
      <p className="text-[11px] text-[#434653] md:hidden">
        ← 可左右滑動查看完整關係圖 →
      </p>
    </div>
  );
}
