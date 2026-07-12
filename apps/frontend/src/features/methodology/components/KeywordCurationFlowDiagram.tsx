import type { CurationFlowGroupId, CurationFlowNode, CurationFlowView } from '../content/keywordCurationFlow';
import { DiagramCanvas } from './diagram/DiagramCanvas';
import { buildDiagramLayout } from './diagramLayout';
import { GROUP_META, NODE_ICON_SLUGS } from './keywordCurationFlowIcons';

export interface KeywordCurationFlowDiagramProps {
  readonly view: CurationFlowView;
  readonly nodes: readonly CurationFlowNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

// Keyword 策展流程圖（單一視角）：依群組分區塊框起來（準備資料／AI 分類與人工決策／資料庫寫入），
// 由共用的 DiagramCanvas 繪製，點節點看該步驟的角色與用途。
export function KeywordCurationFlowDiagram({
  view,
  nodes,
  selectedNodeId,
  onSelectNode,
}: KeywordCurationFlowDiagramProps) {
  const groupOf = (id: string): string => nodes.find(n => n.id === id)?.group ?? 'context';
  const layout = buildDiagramLayout(view, groupOf, view.clusterRows);

  return (
    <DiagramCanvas
      nodes={nodes}
      layout={layout}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      metaOf={group => GROUP_META[group as CurationFlowGroupId]}
      iconSlugsOf={node => NODE_ICON_SLUGS[node.id] ?? GROUP_META[node.group].slugs}
      idPrefix="curation-flow"
      testId="curation-flow-scroll"
      ariaLabel={`Keyword 策展流程：${view.title}`}
      scrollHint={<p className="text-[11px] text-[#434653] md:hidden">← 左右滑動看全圖，點節點看說明 →</p>}
    />
  );
}
