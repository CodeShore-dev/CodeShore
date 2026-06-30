import { useJobHostStatistics } from '../../../hooks/useJobHostStatistics';
import { useCrawlerPipelineView } from '../composables/useCrawlerPipelineView';
import { crawlerPipeline } from '../content/crawlerPipeline';
import type { CrawlerNode } from '../content/crawlerPipeline';
import { CrawlerPipelineDiagram } from './CrawlerPipelineDiagram';
import { CrawlerPipelineNodeDetail } from './CrawlerPipelineNodeDetail';
import { GROUP_META, NODE_ICON_SLUGS } from './crawlerPipelineIcons';
import { ViewTabBar } from './diagram/ViewTabBar';
import { buildNodeRelations } from './nodeRelations';

/**
 * 資料來源與爬蟲區塊容器（深連結錨點 #data-crawler）。
 *
 * 以與雲端架構區塊相同的模式呈現：自持 useCrawlerPipelineView 狀態，組裝視角切換
 *（抓取流程／執行模式）、關係圖與節點詳細。視角切換為純前端狀態切換；切換視角時 hook
 * 會清除既有節點選取（詳細面板隨之關閉）。簡介與揭露說明為靜態內容，一律存在於 DOM。
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

  // 簡介中的來源以「即時職缺佔比」呈現（取代寫死數據）；佔比未就緒時只顯示名稱。
  const shareLabel = (name: string, pct?: number): string => (pct != null ? `${name}（約佔 ${pct}%）` : name);
  const introText =
    `職缺資料由爬蟲自動抓取兩大公開來源——${shareLabel('104 人力銀行', share104)} 與 ${shareLabel('Cake', shareCake)}：` +
    '以 headless 瀏覽器抓取列表與詳細頁，解析後正規化並批次寫入資料庫，列表頁進度可斷點續抓。' +
    '切換下方視角，可分別了解「新增」與「更新（重抓並比對變動）」兩種流程。';

  const relations = state.selectedNode
    ? buildNodeRelations(
        state.selectedNode.id,
        state.activeView.edges,
        crawlerPipeline.nodes,
        (n: CrawlerNode) => NODE_ICON_SLUGS[n.id] ?? GROUP_META[n.group].slugs,
      )
    : { incoming: [], outgoing: [] };

  return (
    <section id="data-crawler" className="mb-12 scroll-mt-20">
      <h2 className="mb-4 text-xl font-black tracking-tight text-[#003d92]">資料來源與爬蟲</h2>
      <p className="mb-4 max-w-4xl text-sm leading-relaxed text-[#1f2330]">{introText}</p>
      <ViewTabBar views={views} selectedId={state.view} onSelect={state.setView} ariaLabel="切換視角" />

      <div className="gap-2 space-y-6 md:flex md:space-y-0">
        <CrawlerPipelineDiagram
          view={state.activeView}
          nodes={crawlerPipeline.nodes}
          selectedNodeId={state.selectedNodeId}
          onSelectNode={state.selectNode}
          hostShares={hostShares}
        />
        <CrawlerPipelineNodeDetail
          node={state.selectedNode}
          onClose={state.clearSelection}
          relations={relations}
          hostShares={hostShares}
        />
      </div>
    </section>
  );
}
