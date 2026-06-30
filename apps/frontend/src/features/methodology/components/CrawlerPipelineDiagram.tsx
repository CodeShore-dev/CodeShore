import type { CrawlerGroupId, CrawlerNode, CrawlerView } from '../content/crawlerPipeline';
import { GROUP_META, NODE_ICON_SLUGS } from './crawlerPipelineIcons';
import { DiagramCanvas } from './diagram/DiagramCanvas';
import { buildDiagramLayout } from './diagramLayout';

export interface CrawlerPipelineDiagramProps {
  readonly view: CrawlerView;
  readonly nodes: readonly CrawlerNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  // 來源網域 -> 即時職缺佔比（0–100 整數），來自 get_job_host_statistics。
  // 當節點 detail.hostKey 命中時，label 後會附上「N%」。
  readonly hostShares?: Record<string, number | undefined>;
}

/**
 * 資料來源與爬蟲（單一視角）：依群組分區塊框起來（資料來源／爬蟲引擎／處理管線／資料庫／執行模式），
 * 由共用的 DiagramCanvas 繪製;命中 hostKey 的節點在名稱後附上即時職缺佔比。
 */
export function CrawlerPipelineDiagram({
  view,
  nodes,
  selectedNodeId,
  onSelectNode,
  hostShares,
}: CrawlerPipelineDiagramProps) {
  const groupOf = (id: string): string => nodes.find(n => n.id === id)?.group ?? 'detail-pipeline';
  const layout = buildDiagramLayout(view, groupOf, view.clusterRows);

  return (
    <DiagramCanvas
      nodes={nodes}
      layout={layout}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      metaOf={group => GROUP_META[group as CrawlerGroupId]}
      iconSlugsOf={node => NODE_ICON_SLUGS[node.id] ?? GROUP_META[node.group].slugs}
      idPrefix="pipeline"
      testId="pipeline-scroll"
      ariaLabel={`資料來源與爬蟲：${view.title}`}
      renderLabelSuffix={node => {
        const hostKey = node.detail?.hostKey;
        const sharePercent = hostKey ? hostShares?.[hostKey] : undefined;
        return sharePercent != null ? <span className="ml-1 font-normal text-[#5b6070]"> {sharePercent}%</span> : null;
      }}
      scrollHint={<p className="text-[11px] text-[#434653] md:hidden">← 左右滑動看全圖，點節點看關聯 →</p>}
    />
  );
}
