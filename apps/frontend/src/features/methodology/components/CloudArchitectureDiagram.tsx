import type { ArchNode, ArchView, CloudProviderId } from '../content/cloudArchitecture';
import { NODE_ICON_SLUGS, PROVIDER_META } from './cloudArchitectureIcons';
import { buildArchLayout } from './cloudArchitectureLayout';
import { DiagramCanvas } from './diagram/DiagramCanvas';

export interface CloudArchitectureDiagramProps {
  readonly view: ArchView;
  readonly nodes: readonly ArchNode[];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
}

/**
 * 雲端與 CI/CD 架構（單一視角）：依供應商分區塊框起來（Cloudflare／AWS／GCP／Azure／共用），
 * 由共用的 DiagramCanvas 繪製;此處只負責計算供應商版面並注入品牌中繼資料／圖示。
 */
export function CloudArchitectureDiagram({ view, nodes, selectedNodeId, onSelectNode }: CloudArchitectureDiagramProps) {
  const layout = buildArchLayout(view, nodes);

  return (
    <DiagramCanvas
      nodes={nodes}
      layout={layout}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      metaOf={group => PROVIDER_META[group as CloudProviderId]}
      iconSlugsOf={node => NODE_ICON_SLUGS[node.id] ?? PROVIDER_META[node.provider].slugs}
      idPrefix="arch"
      testId="arch-scroll"
      ariaLabel={`雲端與 CI/CD 架構：${view.title}`}
      scrollHint={<p className="text-center text-[11px] text-[#434653] md:hidden">← 左右滑動看全圖，點節點看關聯 →</p>}
    />
  );
}
