import { useDatabaseSchemaView } from '../composables/useDatabaseSchemaView';
import { databaseSchema } from '../content/databaseSchema';
import type { DbNode } from '../content/databaseSchema';
import { DatabaseSchemaDiagram } from './DatabaseSchemaDiagram';
import { DatabaseSchemaNodeDetail } from './DatabaseSchemaNodeDetail';
import { GROUP_META, NODE_ICON_SLUGS } from './databaseSchemaIcons';
import { ViewTabBar } from './diagram/ViewTabBar';
import { buildNodeRelations } from './nodeRelations';

/**
 * 資料庫架構區塊容器（深連結錨點 #database）。
 *
 * 以與其他關係圖區塊相同的模式呈現：自持 useDatabaseSchemaView 狀態，組裝 tab 切換
 *（資料表關聯／物化視圖來源／Function 讀寫）、關係圖與節點詳細。tab 切換為純前端狀態切換；
 * 切換 tab 時 hook 會清除既有節點選取（詳細面板隨之關閉）。簡介為靜態內容，一律存在於 DOM。
 * 節點與關聯對齊 supabase/schema.sql 中實際存在的物件，僅描述結構與關聯、不含機密。
 */
export function DatabaseSchemaSection() {
  const state = useDatabaseSchemaView();
  const views = Object.values(databaseSchema.views);

  const relations = state.selectedNode
    ? buildNodeRelations(
        state.selectedNode.id,
        state.activeView.edges,
        databaseSchema.nodes,
        (n: DbNode) => NODE_ICON_SLUGS[n.id] ?? GROUP_META[n.group].slugs,
      )
    : { incoming: [], outgoing: [] };

  return (
    <section id="database" className="mb-12 scroll-mt-20">
      <h2 className="mb-4 text-xl font-black tracking-tight text-[#003d92]">資料庫架構</h2>
      <p className="mb-4 max-w-4xl text-sm leading-relaxed text-[#1f2330]">
        資料庫採用 Supabase（PostgreSQL），分為三層：<strong>原始資料表</strong>保存爬蟲寫入的事實資料、
        <strong>物化視圖</strong>（mv_*）把昂貴的彙總預先算好落地、<strong>function</strong>
        則提供統計查詢與視圖重新整理的入口。
        切換下方分頁，可分別了解資料表之間的外鍵關聯、各物化視圖由哪些表彙總而來、以及 function
        讀寫了哪些物件。點節點可看該物件的角色與用途。
      </p>
      <ViewTabBar views={views} selectedId={state.view} onSelect={state.setView} ariaLabel="切換分頁" />

      <div className="gap-2 space-y-6 md:flex md:space-y-0">
        <DatabaseSchemaDiagram
          view={state.activeView}
          nodes={databaseSchema.nodes}
          selectedNodeId={state.selectedNodeId}
          onSelectNode={state.selectNode}
        />
        <DatabaseSchemaNodeDetail node={state.selectedNode} onClose={state.clearSelection} relations={relations} />
      </div>
    </section>
  );
}
