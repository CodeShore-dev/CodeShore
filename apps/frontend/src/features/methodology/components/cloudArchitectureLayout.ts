import type { ArchNode, ArchView, ArchViewId } from '../content/cloudArchitecture';
import { type DiagramLayout, buildDiagramLayout } from './diagramLayout';

export { NODE_W, NODE_H } from './diagramLayout';
export type {
  DiagramLayout as ArchLayout,
  DiagramNodeBox as ArchNodeBox,
  DiagramBand as ArchBand,
  DiagramEdgePath as ArchEdgePath,
} from './diagramLayout';

// 各視角的供應商區塊排列（由上而下的流程列；同一列的供應商並排）。
// 入口在上、並行的雲在中間並排、共用匯流在下 —— 箭頭只跨越列間的淨空，不會被節點擋住。
const CLUSTER_ROWS: Record<ArchViewId, readonly (readonly string[])[]> = {
  traffic: [['cloudflare'], ['aws', 'azure', 'gcp'], ['supabase']],
  cicd: [['github'], ['gcp', 'aws', 'azure']],
};

export function buildArchLayout(view: ArchView, nodes: readonly ArchNode[]): DiagramLayout {
  const providerOf = (id: string): string => nodes.find(n => n.id === id)?.provider ?? 'shared';
  return buildDiagramLayout(view, providerOf, CLUSTER_ROWS[view.id] ?? []);
}
