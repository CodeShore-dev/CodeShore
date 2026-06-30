import type { DbGroupId, DbNode, DbView } from '../content/databaseSchema';
import { GROUP_META, NODE_ICON_SLUGS } from './databaseSchemaIcons';
import { DiagramCanvas } from './diagram/DiagramCanvas';
import { buildDiagramLayout } from './diagramLayout';

export interface DatabaseSchemaDiagramProps {
  readonly view: DbView;
  readonly nodes: readonly DbNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

/**
 * 資料庫架構（單一 tab）：依群組分區塊框起來（職缺核心／技術字典／地點／使用者偏好／爬蟲來源／
 * 物化視圖／function），由共用的 DiagramCanvas 繪製。物件名稱較長,採等寬字體並允許換行。
 */
export function DatabaseSchemaDiagram({ view, nodes, selectedNodeId, onSelectNode }: DatabaseSchemaDiagramProps) {
  const groupOf = (id: string): string => nodes.find(n => n.id === id)?.group ?? 'job';
  const layout = buildDiagramLayout(view, groupOf, view.clusterRows);

  return (
    <DiagramCanvas
      nodes={nodes}
      layout={layout}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      metaOf={group => GROUP_META[group as DbGroupId]}
      iconSlugsOf={node => NODE_ICON_SLUGS[node.id] ?? GROUP_META[node.group].slugs}
      idPrefix="database-schema"
      testId="database-schema-scroll"
      ariaLabel={`資料庫架構：${view.title}`}
      outerClassName="w-full"
      nodeIconSize={20}
      nodeLabelClassName="block font-mono text-[11px] font-bold break-all text-[#001f2a]"
      nodeRoleClassName="line-clamp-1 block text-[10px] text-[#434653]"
    />
  );
}
