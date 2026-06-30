import type { ReactNode } from 'react';

import { TechIcon } from '../../../../components/TechIcon';
import { ClickAffordance } from '../ClickAffordance';
import { EdgeLayer } from '../EdgeLayer';
import { type DiagramLayout, NODE_H, NODE_W } from '../diagramLayout';
import type { DiagramNodeBase, GroupMeta } from './types';
import { useDragScroll } from './useDragScroll';

export interface DiagramCanvasProps<TNode extends DiagramNodeBase> {
  readonly nodes: readonly TNode[];
  // 已算好的版面（群組框、節點座標、連線路徑）；由各 domain 以自己的 layout builder 提供。
  readonly layout: DiagramLayout;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  // 由群組鍵取得群組框的顯示中繼資料（名稱／主題色／圖示）。
  readonly metaOf: (groupKey: string) => GroupMeta;
  // 由節點取得代表圖示 slug（通常為 NODE_ICON_SLUGS[id] ?? 群組圖示）。
  readonly iconSlugsOf: (node: TNode) => readonly string[];
  // EdgeLayer 的 marker / id 前綴（各圖唯一，避免 SVG marker id 衝突）。
  readonly idPrefix: string;
  readonly testId: string;
  // 圖表 group 的完整無障礙標籤（如「雲端與 CI/CD 架構：流量」）。
  readonly ariaLabel: string;
  // 外層容器 className（資料庫架構較寬，故可不套 max-w-4xl）。
  readonly outerClassName?: string;
  // 節點本體樣式（資料庫物件名較長，採較小字＋等寬）。
  readonly nodeIconSize?: number;
  readonly nodeLabelClassName?: string;
  readonly nodeRoleClassName?: string;
  // 標籤後綴（如爬蟲在名稱後附上即時職缺佔比 badge）。
  readonly renderLabelSuffix?: (node: TNode) => ReactNode;
  // 捲動提示（窄螢幕顯示）；各 domain 文案／對齊略異，無則不顯示。
  readonly scrollHint?: ReactNode;
}

const DEFAULT_LABEL_CLASS = 'block text-[12px] font-bold text-[#001f2a]';
const DEFAULT_ROLE_CLASS = 'line-clamp-2 block text-[11px] text-[#434653]';

/**
 * 關係圖畫布（領域無關）：依群組分「區塊」框起來，區塊內節點以圖示 + 名稱 + 角色呈現，
 * 節點間以箭頭表達關係。疊層繪製：底層 SVG 畫區塊框與箭頭，上層為可點的 HTML 節點按鈕。
 * 整張圖原始尺寸排版，外層容器在窄螢幕水平捲動，頁面版面不破。
 *
 * 四個 methodology 關係圖共用本元件,差異(版面演算法、群組中繼資料、節點樣式、捲動提示)
 * 由 props 注入；各 domain 仍保留自己的薄包裝元件以維持既有對外 props。
 */
export function DiagramCanvas<TNode extends DiagramNodeBase>({
  nodes,
  layout,
  selectedNodeId,
  onSelectNode,
  metaOf,
  iconSlugsOf,
  idPrefix,
  testId,
  ariaLabel,
  outerClassName = 'max-w-4xl space-y-2',
  nodeIconSize = 22,
  nodeLabelClassName = DEFAULT_LABEL_CLASS,
  nodeRoleClassName = DEFAULT_ROLE_CLASS,
  renderLabelSuffix,
  scrollHint,
}: DiagramCanvasProps<TNode>) {
  const scrollRef = useDragScroll<HTMLDivElement>();

  const nodeOf = (id: string): TNode | undefined => nodes.find(n => n.id === id);

  const renderBody = (node: TNode) => (
    <>
      <TechIcon slugs={[...iconSlugsOf(node)]} label={node.label} size={nodeIconSize} hideIfNotFound={false} />
      <span className="min-w-0 leading-tight">
        <span className={nodeLabelClassName}>
          {node.label}
          {renderLabelSuffix?.(node)}
        </span>
        {node.detail ? <span className={nodeRoleClassName}>{node.detail.role}</span> : null}
      </span>
      {node.interactive ? <ClickAffordance active={selectedNodeId === node.id} /> : null}
    </>
  );

  return (
    <div role="group" aria-label={ariaLabel} className={outerClassName}>
      <div
        ref={scrollRef}
        data-testid={testId}
        className="lg:max-w-3xl max-w-full cursor-grab overflow-x-auto rounded-xl border border-[#c3c6d5] bg-[#f4faff] p-3"
      >
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
            className="absolute inset-0"
          >
            {layout.bands.map(band => {
              const meta = metaOf(band.group);
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
            <EdgeLayer edges={layout.edges} idPrefix={idPrefix} selectedNodeId={selectedNodeId} />
          </svg>

          {layout.bands.map(band => {
            const meta = metaOf(band.group);
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
                title="點看詳情"
                onClick={() => onSelectNode(node.id)}
                className={`group absolute flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003d92] ${
                  selected ? 'border-[#003d92] bg-[#d9f2ff]' : 'border-[#c3c6d5] bg-white hover:bg-[#f4faff]'
                }`}
              >
                {renderBody(node)}
              </button>
            );
          })}
        </div>
      </div>
      {scrollHint}
    </div>
  );
}
