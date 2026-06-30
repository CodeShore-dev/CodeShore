import type { DbNode } from '../content/databaseSchema';
import { DiagramNodeDetail } from './diagram/DiagramNodeDetail';
import type { NodeRelations } from './nodeRelations';

export interface DatabaseSchemaNodeDetailProps {
  readonly node: DbNode | null;
  readonly onClose: () => void;
  // 本節點在目前 tab 的上下游關聯（次要資訊）。
  readonly relations?: NodeRelations;
}

// 資料庫架構節點詳細面板：標題為資料庫物件名稱（等寬字體、允許換行），usage 含靜態信任 HTML。
export function DatabaseSchemaNodeDetail(props: DatabaseSchemaNodeDetailProps) {
  return <DiagramNodeDetail {...props} usageAsHtml monoTitle />;
}
