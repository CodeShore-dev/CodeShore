import type { ArchNode } from '../content/cloudArchitecture';
import { DiagramNodeDetail } from './diagram/DiagramNodeDetail';
import type { NodeRelations } from './nodeRelations';

export interface CloudArchNodeDetailProps {
  readonly node: ArchNode | null;
  readonly onClose: () => void;
  // 本節點在目前視角的上下游關聯（次要資訊）。
  readonly relations?: NodeRelations;
}

// 雲端架構節點詳細面板：role／usage 皆為純文字（無內嵌 HTML）。
export function CloudArchNodeDetail(props: CloudArchNodeDetailProps) {
  return <DiagramNodeDetail {...props} />;
}
