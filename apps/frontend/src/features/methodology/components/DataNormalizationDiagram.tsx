import type { DataFlowGroupId, DataFlowNode, DataFlowView } from '../content/dataNormalization';
import { GROUP_META, NODE_ICON_SLUGS } from './dataNormalizationIcons';
import { DiagramCanvas } from './diagram/DiagramCanvas';
import { buildDiagramLayout } from './diagramLayout';

export interface DataNormalizationDiagramProps {
  readonly view: DataFlowView;
  readonly nodes: readonly DataFlowNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

/**
 * 資料正規化流程（單一視角）：依群組分區塊框起來（原始職缺／寫入時加工／事實資料表／事後加工／
 * 衍生資料表／物化視圖），由共用的 DiagramCanvas 繪製。
 */
export function DataNormalizationDiagram({ view, nodes, selectedNodeId, onSelectNode }: DataNormalizationDiagramProps) {
  const groupOf = (id: string): string => nodes.find(n => n.id === id)?.group ?? 'fact';
  const layout = buildDiagramLayout(view, groupOf, view.clusterRows);

  return (
    <DiagramCanvas
      nodes={nodes}
      layout={layout}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      metaOf={group => GROUP_META[group as DataFlowGroupId]}
      iconSlugsOf={node => NODE_ICON_SLUGS[node.id] ?? GROUP_META[node.group].slugs}
      idPrefix="normalization"
      testId="normalization-scroll"
      ariaLabel={`資料正規化流程：${view.title}`}
      scrollHint={<p className="text-[11px] text-[#434653] md:hidden">← 左右滑動看全圖，點節點看關聯 →</p>}
    />
  );
}
