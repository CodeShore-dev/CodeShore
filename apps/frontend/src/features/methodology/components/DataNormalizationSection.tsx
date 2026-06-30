import { useDataNormalizationView } from '../composables/useDataNormalizationView';
import { dataNormalization } from '../content/dataNormalization';
import type { DataFlowNode } from '../content/dataNormalization';
import { DataNormalizationDiagram } from './DataNormalizationDiagram';
import { DataNormalizationNodeDetail } from './DataNormalizationNodeDetail';
import { GROUP_META, NODE_ICON_SLUGS } from './dataNormalizationIcons';
import { ViewTabBar } from './diagram/ViewTabBar';
import { buildNodeRelations } from './nodeRelations';

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

  const relations = state.selectedNode
    ? buildNodeRelations(
        state.selectedNode.id,
        state.activeView.edges,
        dataNormalization.nodes,
        (n: DataFlowNode) => NODE_ICON_SLUGS[n.id] ?? GROUP_META[n.group].slugs,
      )
    : { incoming: [], outgoing: [] };

  return (
    <section id="data-normalization" className="mb-12 scroll-mt-20">
      <h2 className="mb-4 text-xl font-black tracking-tight text-[#003d92]">資料正規化流程</h2>
      <p className="mb-4 max-w-4xl text-sm leading-relaxed text-[#1f2330]">
        爬蟲抓到的原始職缺不會原樣存進單表，而是先「拆表」再「加工」：寫入時解析<strong>薪資</strong>與
        <strong>關鍵字</strong>、拆成 job／company／job_keyword 三張事實表；之後離線把<strong>關鍵字</strong>歸併為
        <strong>技術</strong>、雜亂<strong>地點</strong>歸併為<strong>地點群組</strong>
        ，最後以物化視圖預先彙總供分析頁直接取用。切換下方視角，可分別了解這兩個階段。
      </p>
      <ViewTabBar views={views} selectedId={state.view} onSelect={state.setView} ariaLabel="切換視角" />

      <div className="gap-2 space-y-6 md:flex md:space-y-0">
        <DataNormalizationDiagram
          view={state.activeView}
          nodes={dataNormalization.nodes}
          selectedNodeId={state.selectedNodeId}
          onSelectNode={state.selectNode}
        />
        <DataNormalizationNodeDetail node={state.selectedNode} onClose={state.clearSelection} relations={relations} />
      </div>
    </section>
  );
}
