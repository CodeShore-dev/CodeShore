import { useState } from 'react';

import type { DiagramEdgePath } from './diagramLayout';

export interface EdgeLayerProps {
  readonly edges: readonly DiagramEdgePath[];
  // 標記（箭頭／起點圓點）id 前綴，需在整頁唯一（多張圖同時存在於 DOM）。
  readonly idPrefix: string;
  // 目前選取的節點：與其相連（進或出）的邊會一起點亮。
  readonly selectedNodeId?: string | null;
}

/**
 * 關係圖的連線層（SVG）：箭頭／起點標記 + 每條邊。
 *
 * 預設只畫線、不顯示 label，維持流程圖乾淨；要看「某條線在幹嘛」有兩種方式：
 *  - 點選節點：與該節點相連（進或出）的邊一起點亮並顯示 label（桌機與行動裝置皆可，由父層傳入
 *    selectedNodeId）。
 *  - 桌機 hover：游標移到單一線上時，也會以白描邊小字顯示該條 label 並 highlight，方便快速查看。
 *
 * 繪製分兩層：先畫「所有線」，再於最上層畫「所有 label」。因為 SVG 以文件順序決定疊放，
 * 若 label 與其線同組，後面邊的白光暈與線會蓋掉前面邊的 label；把 label 全部抬到線之上即可避免。
 * 兩層共用 hover 狀態（label 已不在線的同一 DOM 子樹，無法用 group-hover，改以 React state 驅動）。
 *
 * 細線不好 hover，故每條邊額外鋪一條透明的寬「命中區」(pointer-events: stroke)；可見線與 label
 * 皆 pointer-events: none，只由命中區驅動 hover。標記以 fill=context-stroke 跟隨線色變色。
 */
export function EdgeLayer({ edges, idPrefix, selectedNodeId }: EdgeLayerProps) {
  const arrowId = `${idPrefix}-arrow`;
  const startId = `${idPrefix}-start`;
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // 邊是否處於「點亮」狀態：選取節點相連、或滑鼠停在其命中區上。
  const isActive = (edge: DiagramEdgePath): boolean =>
    (selectedNodeId != null && (edge.from === selectedNodeId || edge.to === selectedNodeId)) || hoveredKey === edge.key;

  return (
    <>
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
        <marker id={startId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
          <circle cx="5" cy="5" r="3.5" fill="context-stroke" />
        </marker>
      </defs>

      {/* 線層：命中區 + 白光暈 + 可見線。 */}
      {edges.map(edge => {
        const active = isActive(edge);
        return (
          <g key={edge.key}>
            {/* 透明寬命中區：讓細線在桌機好 hover */}
            <path
              d={edge.d}
              fill="none"
              stroke="transparent"
              strokeWidth={22}
              style={{ pointerEvents: 'stroke' }}
              onMouseEnter={() => setHoveredKey(edge.key)}
              onMouseLeave={() => setHoveredKey(prev => (prev === edge.key ? null : prev))}
            />
            {/* 白底光暈，讓線在交錯處仍清楚 */}
            <path
              d={edge.d}
              fill="none"
              stroke="#f4faff"
              strokeWidth={5}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
            {/* 可見線：hover／鎖定時整條（含標記）轉主色並加粗 */}
            <path
              data-edge
              d={edge.d}
              fill="none"
              stroke={active ? '#003d92' : '#7a8aa0'}
              strokeWidth={active ? 2.4 : 1.7}
              markerStart={`url(#${startId})`}
              markerEnd={`url(#${arrowId})`}
              className="transition-[stroke,stroke-width] duration-150"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}

      {/* Label 層：畫在所有線之上，避免被其他邊的線／光暈蓋住。 */}
      {edges.map(edge =>
        edge.label ? (
          <text
            key={edge.key}
            x={edge.lx}
            y={edge.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[#003d92] text-[10px] font-semibold transition-opacity duration-150"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              paintOrder: 'stroke',
              stroke: '#f4faff',
              strokeWidth: 3,
              strokeLinejoin: 'round',
              opacity: isActive(edge) ? 1 : 0,
            }}
          >
            {edge.label}
          </text>
        ) : null,
      )}
    </>
  );
}
