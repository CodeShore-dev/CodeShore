import { useJobHostStatistics } from '../../../hooks/useJobHostStatistics';
import { useCrawlerPipelineView } from '../composables/useCrawlerPipelineView';
import { crawlerPipeline } from '../content/crawlerPipeline';
import { CrawlerPipelineDiagram } from './CrawlerPipelineDiagram';
import { CrawlerPipelineNodeDetail } from './CrawlerPipelineNodeDetail';

/**
 * 資料來源與爬蟲區塊容器（深連結錨點 #data-crawler）。
 *
 * 以與雲端架構區塊相同的模式呈現：自持 useCrawlerPipelineView 狀態，組裝視角切換
 *（抓取流程／執行模式）、關係圖與節點詳情。視角切換為純前端狀態切換；切換視角時 hook
 * 會清除既有節點選取（詳情面板隨之關閉）。簡介與揭露說明為靜態內容，一律存在於 DOM。
 */
export function CrawlerPipelineSection() {
  const state = useCrawlerPipelineView();
  const views = Object.values(crawlerPipeline.views);

  // 兩個來源平台的「真實」職缺佔比，取自 get_job_host_statistics（取代寫死的 54%／28%）。
  const { percentFor } = useJobHostStatistics();
  const share104 = percentFor('104.com.tw');
  const shareCake = percentFor('cake.me');
  const hostShares: Record<string, number | undefined> = {
    '104.com.tw': share104,
    'cake.me': shareCake,
  };
  const shareSuffix = (percent: number | undefined): string =>
    percent != null ? `（約佔 ${percent}%）` : '';

  return (
    <section id="data-crawler" className="mb-12 scroll-mt-20">
      <h2 className="mb-4 text-xl font-black tracking-tight text-[#003d92]">資料來源與爬蟲</h2>
      <p className="mb-6 max-w-4xl text-sm leading-relaxed text-[#1f2330]">
        我們爬取公開招募頁面、做分析。
        資料來源為兩個公開職缺平台：104 人力銀行{shareSuffix(share104)}與 Cake
        {shareSuffix(shareCake)}。
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
        <CrawlerPipelineDiagram
          view={state.activeView}
          nodes={crawlerPipeline.nodes}
          selectedNodeId={state.selectedNodeId}
          onSelectNode={state.selectNode}
        />
        <CrawlerPipelineNodeDetail
          node={state.selectedNode}
          onClose={state.clearSelection}
          hostShares={hostShares}
        />
      </div>

    </section>
  );
}
