import { TechIcon } from '../../../components/TechIcon';
import type { ArchNode, ArchView, CloudProviderId } from '../content/cloudArchitecture';
import { NODE_ICON_SLUGS, PROVIDER_META } from './cloudArchitectureIcons';
import { buildArchLayout, NODE_H, NODE_W } from './cloudArchitectureLayout';

export interface CloudArchitectureDiagramProps {
  readonly view: ArchView;
  readonly nodes: readonly ArchNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

/**
 * 雲端架構關係圖（單一視角）：依供應商分「區塊」框起來（Cloudflare／AWS／GCP／Azure／
 * 共用），區塊內節點以品牌圖示 + 名稱 + 負責任務呈現；節點間以箭頭表達關係。疊層繪製：
 * 底層 SVG 畫區塊框與箭頭，上層為可點的 HTML 節點按鈕。整張圖原始尺寸排版，外層容器在
 * 窄螢幕水平捲動，頁面版面不破；文字等價內容由 CloudArchitectureSummary 提供。
 */
export function CloudArchitectureDiagram({
  view,
  nodes,
  selectedNodeId,
  onSelectNode,
}: CloudArchitectureDiagramProps) {
  const layout = buildArchLayout(view, nodes);
  const nodeOf = (id: string): ArchNode | undefined =>
    nodes.find((n) => n.id === id);

  const renderBody = (node: ArchNode) => {
    const slugs = NODE_ICON_SLUGS[node.id] ?? PROVIDER_META[node.provider].slugs;
    return (
      <>
        <TechIcon
          slugs={[...slugs]}
          label={node.label}
          size={22}
          hideIfNotFound={false}
        />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[12px] font-bold text-[#001f2a]">
            {node.label}
          </span>
          {node.detail ? (
            <span className="line-clamp-2 block text-[11px] text-[#434653]">
              {node.detail.role}
            </span>
          ) : null}
        </span>
      </>
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
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
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
            {layout.bands.map((band) => {
              const meta = PROVIDER_META[band.provider as CloudProviderId];
              return (
                <rect
                  key={band.provider}
                  x={band.x}
                  y={band.y}
                  width={band.w}
                  height={band.h}
                  rx={12}
                  fill={meta.hex}
                  fillOpacity={0.05}
                  stroke={meta.hex}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              );
            })}
            {layout.edges.map((edge) => (
              <path
                key={edge.key}
                data-edge
                d={edge.d}
                fill="none"
                stroke="#94a0b4"
                strokeWidth={1.6}
                markerEnd="url(#arch-arrow)"
              />
            ))}
          </svg>

          {layout.bands.map((band) => {
            const meta = PROVIDER_META[band.provider as CloudProviderId];
            return (
              <div
                key={`head-${band.provider}`}
                className="absolute flex items-center gap-1.5"
                style={{ left: band.x + 12, top: band.y + 6 }}
              >
                {meta.slugs.length ? (
                  <TechIcon slugs={[...meta.slugs]} label={meta.name} size={16} />
                ) : null}
                <span className="text-[12px] font-bold" style={{ color: meta.hex }}>
                  {meta.name}
                </span>
              </div>
            );
          })}

          {[...layout.boxes.values()].map((box) => {
            const node = nodeOf(box.id);
            if (!node) return null;
            const common = { left: box.x, top: box.y, width: NODE_W, height: NODE_H };
            if (!node.interactive) {
              return (
                <div
                  key={node.id}
                  style={common}
                  className="absolute flex items-center gap-2 rounded-lg border border-[#c3c6d5] bg-white px-2.5"
                >
                  {renderBody(node)}
                </div>
              );
            }
            const selected = selectedNodeId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                style={common}
                aria-pressed={selected}
                aria-label={node.label}
                onClick={() => onSelectNode(node.id)}
                className={`absolute flex items-center gap-2 rounded-lg border px-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003d92] ${
                  selected
                    ? 'border-[#003d92] bg-[#d9f2ff]'
                    : 'border-[#c3c6d5] bg-white hover:bg-[#f4faff]'
                }`}
              >
                {renderBody(node)}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-[#434653] md:hidden">
        ← 可左右滑動查看完整關係圖 →
      </p>
    </div>
  );
}
