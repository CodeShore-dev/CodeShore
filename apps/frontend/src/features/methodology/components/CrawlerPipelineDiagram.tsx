import { TechIcon } from '../../../components/TechIcon';
import type { CrawlerGroupId, CrawlerNode, CrawlerView } from '../content/crawlerPipeline';
import { GROUP_META, NODE_ICON_SLUGS } from './crawlerPipelineIcons';
import { NODE_H, NODE_W, buildDiagramLayout } from './diagramLayout';

export interface CrawlerPipelineDiagramProps {
  readonly view: CrawlerView;
  readonly nodes: readonly CrawlerNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  // 來源網域 -> 即時職缺佔比（0–100 整數），來自 get_job_host_statistics。
  // 當節點 detail.hostKey 命中時，label 後會附上「約佔 N%」。
  readonly hostShares?: Record<string, number | undefined>;
}

/**
 * 資料來源與爬蟲（單一視角）：依群組分「區塊」框起來（資料來源／爬蟲引擎／處理管線／資料庫／
 * 執行模式），區塊內節點以圖示 + 名稱 + 角色呈現；節點間以箭頭表達關係。疊層繪製：底層 SVG
 * 畫區塊框與箭頭，上層為可點的 HTML 節點按鈕。整張圖原始尺寸排版，外層容器在窄螢幕水平捲動，
 * 頁面版面不破。
 */
export function CrawlerPipelineDiagram({
  view,
  nodes,
  selectedNodeId,
  onSelectNode,
  hostShares,
}: CrawlerPipelineDiagramProps) {
  const nodeOf = (id: string): CrawlerNode | undefined => nodes.find(n => n.id === id);
  const groupOf = (id: string): string => nodeOf(id)?.group ?? 'detail-pipeline';
  const layout = buildDiagramLayout(view, groupOf, view.clusterRows);

  const renderBody = (node: CrawlerNode) => {
    const slugs = NODE_ICON_SLUGS[node.id] ?? GROUP_META[node.group].slugs;
    const hostKey = node.detail?.hostKey;
    const sharePercent = hostKey ? hostShares?.[hostKey] : undefined;
    return (
      <>
        <TechIcon slugs={[...slugs]} label={node.label} size={22} hideIfNotFound={false} />
        <span className="min-w-0 leading-tight">
          <span className="block text-[12px] font-bold text-[#001f2a]">
            {node.label}
            {sharePercent != null ? (
              <span className="ml-1 font-normal text-[#5b6070]"> {sharePercent}%</span>
            ) : null}
          </span>
          {node.detail ? (
            <span className="line-clamp-2 block text-[11px] text-[#434653]">{node.detail.role}</span>
          ) : null}
        </span>
      </>
    );
  };

  return (
    <div role="group" aria-label={`資料來源與爬蟲：${view.title}`} className="max-w-4xl space-y-2">
      <div
        data-testid="pipeline-scroll"
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
                id="pipeline-arrow"
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
            {layout.bands.map(band => {
              const meta = GROUP_META[band.group as CrawlerGroupId];
              return (
                <rect
                  key={band.group}
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
            {layout.edges.map(edge => (
              <path
                key={`halo-${edge.key}`}
                d={edge.d}
                fill="none"
                stroke="#f4faff"
                strokeWidth={5}
                strokeLinecap="round"
              />
            ))}
            {layout.edges.map(edge => (
              <path
                key={edge.key}
                data-edge
                d={edge.d}
                fill="none"
                stroke="#7a8aa0"
                strokeWidth={1.7}
                markerEnd="url(#pipeline-arrow)"
              />
            ))}
          </svg>

          {layout.bands.map(band => {
            const meta = GROUP_META[band.group as CrawlerGroupId];
            return (
              <div
                key={`head-${band.group}`}
                className="absolute flex items-center gap-1.5"
                style={{ left: band.x + 12, top: band.y + 6 }}
              >
                {meta.slugs.length ? <TechIcon slugs={[...meta.slugs]} label={meta.name} size={16} /> : null}
                <span className="text-[12px] font-bold" style={{ color: meta.hex }}>
                  {meta.name}
                </span>
              </div>
            );
          })}

          {[...layout.boxes.values()].map(box => {
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
                className={`absolute flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003d92] ${
                  selected ? 'border-[#003d92] bg-[#d9f2ff]' : 'border-[#c3c6d5] bg-white hover:bg-[#f4faff]'
                }`}
              >
                {renderBody(node)}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-[#434653] md:hidden">← 可左右滑動查看完整關係圖 →</p>
    </div>
  );
}
