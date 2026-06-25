import { cloudArchitecture } from '../content/cloudArchitecture';
import { useCloudArchitectureView } from '../composables/useCloudArchitectureView';
import { CloudArchitectureDiagram } from './CloudArchitectureDiagram';
import { CloudArchNodeDetail } from './CloudArchNodeDetail';
import { CloudArchitectureSummary } from './CloudArchitectureSummary';

/**
 * 雲端架構區塊容器（深連結錨點 #cloud-architecture）。
 *
 * 自持 useCloudArchitectureView 狀態，組裝視角切換、關係圖、節點詳情與文字摘要。
 * 視角切換為純前端狀態切換（不重新掛載／載入子元件）；切換視角時 hook 會清除既有
 * 節點選取（詳情面板隨之關閉）。文字摘要為靜態內容，一律存在於 DOM（無載入間隙）。
 */
export function CloudArchitectureSection() {
  const state = useCloudArchitectureView();
  const views = Object.values(cloudArchitecture.views);

  return (
    <section id="cloud-architecture" className="mb-12 scroll-mt-20">
      <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
        ● 雲端架構 · CLOUD
      </p>
      <h2 className="mb-3 text-xl font-black tracking-tight text-[#001f2a]">
        雲端架構關係圖
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-[#434653]">
        CodeShore 以 Cloudflare Worker 為對外唯一入口，依健康狀態自動容錯切換多雲後端。
        切換下方視角可分別檢視「流量」與「CI/CD」兩種觀點；點選節點可查看其在本專案中的角色與用途。
      </p>

      <div
        role="group"
        aria-label="切換視角"
        className="mb-6 flex flex-wrap gap-2"
      >
        {views.map((view) => {
          const selected = state.view === view.id;
          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={selected}
              onClick={() => state.setView(view.id)}
              className={`rounded-full border px-4 py-1.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003d92] ${
                selected
                  ? 'border-[#003d92] bg-[#003d92] text-white'
                  : 'border-[#c3c6d5] bg-white text-[#434653] hover:bg-[#f4faff]'
              }`}
            >
              {view.title}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        <CloudArchitectureDiagram
          view={state.activeView}
          nodes={cloudArchitecture.nodes}
          selectedNodeId={state.selectedNodeId}
          onSelectNode={state.selectNode}
        />
        <CloudArchNodeDetail
          node={state.selectedNode}
          onClose={state.clearSelection}
        />
        <CloudArchitectureSummary architecture={cloudArchitecture} />
      </div>
    </section>
  );
}
