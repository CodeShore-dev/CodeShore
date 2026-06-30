import type { DataFlowNode } from '../content/dataNormalization';
import { DiagramNodeDetail } from './diagram/DiagramNodeDetail';
import type { NodeRelations } from './nodeRelations';

export interface DataNormalizationNodeDetailProps {
  readonly node: DataFlowNode | null;
  readonly onClose: () => void;
  // 本節點在目前視角的上下游關聯（次要資訊）。
  readonly relations?: NodeRelations;
}

// 資料正規化節點詳細面板：usage 含本檔靜態信任的 HTML（如 <strong>）。
export function DataNormalizationNodeDetail(props: DataNormalizationNodeDetailProps) {
  return <DiagramNodeDetail {...props} usageAsHtml />;
}
