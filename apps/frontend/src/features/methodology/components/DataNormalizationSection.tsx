import { useDataNormalizationView } from '../composables/useDataNormalizationView';
import { dataNormalization } from '../content/dataNormalization';
import { DataNormalizationDiagram } from './DataNormalizationDiagram';
import { DataNormalizationNodeDetail } from './DataNormalizationNodeDetail';

/**
 * 資料正規化流程區塊容器（深連結錨點 #data-normalization）。
 *
 * 承接「資料來源與爬蟲」圖中「正規化」節點延後說明的細節，揭露抓到的職缺如何拆成資料表、
 * 哪些資料還要再加工。以與其他關係圖區塊相同的模式呈現：自持 useDataNormalizationView 狀態，
 * 組裝視角切換（寫入時拆表／事後加工）、關係圖與節點詳細。視角切換為純前端狀態切換；切換視角
 * 時 hook 會清除既有節點選取（詳細面板隨之關閉）。簡介為靜態內容，一律存在於 DOM。
 */
export function DataNormalizationSection() {
  const state = useDataNormalizationView();
  const views = Object.values(dataNormalization.views);

  return (
    <section id="data-normalization" className="mb-12 scroll-mt-20">
      <h2 className="mb-4 text-xl font-black tracking-tight text-[#003d92]">資料正規化流程</h2>
      <p className="mb-4 max-w-4xl text-sm leading-relaxed text-[#1f2330]">
        爬蟲抓到的一筆原始職缺，並非原樣存進單一資料表，而是經過「拆表」與「加工」兩步。寫入時即拆成
        job／company／job_keyword 三張事實表，其中薪資與關鍵字會先即時解析；之後再離線把關鍵字歸併成
        技術、把雜亂地點歸併成地點群組，最後由物化視圖預先彙總。點選節點可看各步驟的角色與用途。
      </p>
      <div role="group" aria-label="切換視角" className="mb-3 flex flex-wrap gap-2">
        {views.map(view => {
          const selected = state.view === view.id;
          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={selected}
              onClick={() => state.setView(view.id)}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003d92] ${
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

      <div className="gap-2 space-y-6 md:flex md:space-y-0">
        <DataNormalizationDiagram
          view={state.activeView}
          nodes={dataNormalization.nodes}
          selectedNodeId={state.selectedNodeId}
          onSelectNode={state.selectNode}
        />
        <DataNormalizationNodeDetail node={state.selectedNode} onClose={state.clearSelection} />
      </div>
    </section>
  );
}
