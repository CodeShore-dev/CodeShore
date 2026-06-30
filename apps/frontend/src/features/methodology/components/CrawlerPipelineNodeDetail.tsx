import type { CrawlerNode } from '../content/crawlerPipeline';
import { DiagramNodeDetail } from './diagram/DiagramNodeDetail';
import type { NodeRelations } from './nodeRelations';

export interface CrawlerPipelineNodeDetailProps {
  readonly node: CrawlerNode | null;
  readonly onClose: () => void;
  // 本節點在目前視角的上下游關聯（次要資訊）。
  readonly relations?: NodeRelations;
  // 來源網域 -> 即時職缺佔比（0–100 整數），來自 get_job_host_statistics。
  // 當節點 detail.hostKey 命中時，角色說明後會附上「（約佔 N%）」。
  readonly hostShares?: Record<string, number | undefined>;
}

// 爬蟲節點詳細面板：usage 含靜態信任 HTML；命中 hostKey 的節點在角色後附上即時職缺佔比。
export function CrawlerPipelineNodeDetail({ hostShares, ...rest }: CrawlerPipelineNodeDetailProps) {
  const formatRole = (node: CrawlerNode): string | undefined => {
    const hostKey = node.detail?.hostKey;
    const sharePercent = hostKey ? hostShares?.[hostKey] : undefined;
    return node.detail && sharePercent != null ? `${node.detail.role}（約佔 ${sharePercent}%）` : node.detail?.role;
  };

  return <DiagramNodeDetail {...rest} usageAsHtml formatRole={formatRole} />;
}
