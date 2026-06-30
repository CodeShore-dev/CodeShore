import { TechIcon } from '../../../components/TechIcon';
import { useCloudArchitectureView } from '../composables/useCloudArchitectureView';
import { cloudArchitecture } from '../content/cloudArchitecture';
import type { ArchNode } from '../content/cloudArchitecture';
import { CloudArchNodeDetail } from './CloudArchNodeDetail';
import { CloudArchitectureDiagram } from './CloudArchitectureDiagram';
import { NODE_ICON_SLUGS, PROVIDER_META } from './cloudArchitectureIcons';
import { ViewTabBar } from './diagram/ViewTabBar';
import { buildNodeRelations } from './nodeRelations';

/**
 * 雲端架構區塊容器（深連結錨點 #cloud-architecture）。
 *
 * 自持 useCloudArchitectureView 狀態，組裝視角切換、關係圖、節點詳細與文字摘要。
 * 視角切換為純前端狀態切換（不重新掛載／載入子元件）；切換視角時 hook 會清除既有
 * 節點選取（詳細面板隨之關閉）。文字摘要為靜態內容，一律存在於 DOM（無載入間隙）。
 */
export function CloudArchitectureSection() {
  const state = useCloudArchitectureView();
  const views = Object.values(cloudArchitecture.views);

  const relations = state.selectedNode
    ? buildNodeRelations(
        state.selectedNode.id,
        state.activeView.edges,
        cloudArchitecture.nodes,
        (n: ArchNode) => NODE_ICON_SLUGS[n.id] ?? PROVIDER_META[n.provider].slugs,
      )
    : { incoming: [], outgoing: [] };

  return (
    <section id="cloud-architecture" className="mb-12 scroll-mt-20">
      <h2 className="mb-4 text-xl font-black tracking-tight text-[#003d92]">雲端與 CI/CD 架構</h2>
      <p className="mb-4 max-w-4xl text-sm leading-relaxed text-[#1f2330]">
        本網站採多雲部署：Cloudflare Worker 作為對外唯一入口，依各雲健康狀態自動容錯（AWS 為主力，GCP／Azure
        為備選）。切換下方視角，可分別了解「使用者流量如何導向各雲」與「程式碼如何經 CI/CD 建置並部署到各雲」。
      </p>
      <ViewTabBar views={views} selectedId={state.view} onSelect={state.setView} ariaLabel="切換視角" />

      {state.activeView.description && (
        // description 為本專案靜態信任內容（content registry，無外部輸入），允許內嵌 HTML。
        <p
          className="mb-3 max-w-4xl text-sm leading-relaxed text-[#5b6070]"
          dangerouslySetInnerHTML={{ __html: state.activeView.description }}
        />
      )}

      <div className="gap-2 space-y-6 md:space-y-0 lg:flex">
        <CloudArchitectureDiagram
          view={state.activeView}
          nodes={cloudArchitecture.nodes}
          selectedNodeId={state.selectedNodeId}
          onSelectNode={state.selectNode}
        />
        <CloudArchNodeDetail node={state.selectedNode} onClose={state.clearSelection} relations={relations} />
      </div>
    </section>
  );
}
