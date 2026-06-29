/**
 * 「資料正規化流程」關係圖的唯一可信來源（content registry）。
 *
 * 以與「資料來源與爬蟲」「雲端與 CI/CD 架構」相同的模式呈現：節點依群組框起來、節點間以
 * 箭頭表達關係；多視角共用同一組節點。承接爬蟲圖中「正規化」節點所延後說明的細節，揭露
 * 「抓到的職缺如何拆成資料表、哪些資料還要再加工」的完整正規化流程：
 *  - 寫入時拆表（split）：一筆原始職缺 → 即時加工（薪資解析／關鍵字萃取）→ 拆成 job／
 *    company／job_keyword 三張事實表。
 *  - 事後加工（process）：事實表 → 關鍵字字典／技術映射／地點群組等離線加工 → 衍生資料表 →
 *    物化視圖預先彙總。
 *
 * 圖表、詳細面板與簡介文字皆只讀此模組，從根本保證各視角與文字版內容一致。
 * 內容對齊本專案實際的正規化邏輯（cookRawJob、parseSalary、parseKeywordsOut、reset_keywords、
 * tech_keyword／job_tech 映射、location_group、mv_* 物化視圖），僅描述方法與架構。
 *
 * 安全：本檔僅描述「方法與架構」層級，不含任何金鑰、憑證、連線字串或可重現受保護操作的設定。
 * 語系：zh-TW。
 */

export type DataFlowGroupId = 'raw' | 'cook' | 'fact' | 'derive' | 'derived' | 'mv';
export type DataFlowViewId = 'split' | 'process';

// active=流程主幹；shared=被多個視角共用的端點（事實資料表）
export type DataFlowNodeStatus = 'active' | 'shared';

export interface DataFlowNode {
  readonly id: string; // 穩定 id，供 edge 與選取參照
  readonly label: string; // 顯示名稱（zh-TW）
  readonly group: DataFlowGroupId;
  readonly status: DataFlowNodeStatus;
  readonly interactive: boolean; // 是否可點看詳細
  readonly detail?: {
    // interactive 為 true 時必填（一致性測試強制）
    readonly role: string; // 在正規化流程中的角色
    readonly usage: string; // 用途說明；不得含機密
  };
}

export interface DataFlowEdge {
  readonly from: string; // DataFlowNode.id
  readonly to: string; // DataFlowNode.id
  readonly label?: string; // 關係標註
}

export interface DataFlowView {
  readonly id: DataFlowViewId;
  readonly title: string; // 如「寫入時拆表」「事後加工」
  readonly tiers: readonly (readonly string[])[]; // 分層順序，每層為 node id 陣列
  readonly clusterRows: readonly (readonly DataFlowGroupId[])[]; // 群組框由上而下的流程列排列
  readonly edges: readonly DataFlowEdge[];
}

export interface DataNormalization {
  readonly nodes: readonly DataFlowNode[]; // 多視角共享節點集
  readonly views: Readonly<Record<DataFlowViewId, DataFlowView>>;
  readonly defaultView: DataFlowViewId;
}

export const dataNormalization: DataNormalization = {
  nodes: [
    // ── 原始職缺 ──
    {
      id: 'raw-job',
      label: '原始職缺（一筆）',
      group: 'raw',
      status: 'active',
      interactive: true,
      detail: {
        role: '尚未正規化的來源資料',
        usage:
          '列表 API 的欄位（標題、公司、地點）與詳細頁 HTML（職缺描述、薪資）合併成一筆原始職缺。各來源平台欄位格式不一，需先正規化才能跨來源一致分析。',
      },
    },
    // ── 寫入時加工 ──
    {
      id: 'parse-salary',
      label: '薪資解析 parseSalary',
      group: 'cook',
      status: 'active',
      interactive: true,
      detail: {
        role: '薪資字串 → 結構化欄位',
        usage:
          '從薪資字串解析出 min_salary／max_salary／salary_type：含「年」判為年薪、否則月薪；外幣換算為新台幣（USD×31、JPY×0.2）；「面議」或無數字者給 0–9,999,999 的區間哨兵值，分析時再以市場加權比率推估。',
      },
    },
    {
      id: 'parse-keyword',
      label: '關鍵字萃取 parseKeywordsOut',
      group: 'cook',
      status: 'active',
      interactive: true,
      detail: {
        role: '職缺描述 → 關鍵字陣列',
        usage:
          '從職缺描述萃取技術關鍵字與中英文比例：中文字比例 < 0.4 視為英文職缺，改以技術字典逐詞掃描；否則去除連結、斷詞並濾除停用字。產出 keywords[] 與 description_ch_en_ratio。',
      },
    },
    // ── 寫入時的事實資料表 ──
    {
      id: 'tbl-job',
      label: 'job 職缺主表',
      group: 'fact',
      status: 'shared',
      interactive: true,
      detail: {
        role: '所有分析的事實來源',
        usage:
          '標題、地點、職缺描述、公司、薪資原字串，加上解析出的 min/max_salary、salary_type、closed 等。salary_manual 標記過的薪資不會被自動重算覆蓋。',
      },
    },
    {
      id: 'tbl-company',
      label: 'company 公司主表',
      group: 'fact',
      status: 'shared',
      interactive: true,
      detail: {
        role: '公司事實資料（去重）',
        usage:
          '名稱、連結、類型；以公司 id 與 job 關聯。同一間公司的多筆職缺只保留一筆公司資料，避免重複。',
      },
    },
    {
      id: 'tbl-job-keyword',
      label: 'job_keyword 職缺關鍵字',
      group: 'fact',
      status: 'shared',
      interactive: true,
      detail: {
        role: '每筆職缺的關鍵字原料',
        usage:
          '保存每筆職缺萃取出的 keywords[] 與中英文比例，是後續技術字典與技術映射的原料。三張事實表（job／company／job_keyword）由 cookRawJob 一次拆出、批次 upsert 寫入。',
      },
    },
    // ── 事後加工（離線 / DB function）──
    {
      id: 'kw-dict',
      label: '關鍵字字典彙整',
      group: 'derive',
      status: 'active',
      interactive: true,
      detail: {
        role: '關鍵字 → 字典＋出現次數',
        usage:
          '由 reset_keywords() 把所有 job_keyword.keywords 展開（UNNEST）後聚合成 keyword 字典表與各關鍵字的出現次數，作為技術映射的基底；可離線重跑（job-keyword 模式）以最新字典重萃。',
      },
    },
    {
      id: 'tech-map',
      label: '技術映射',
      group: 'derive',
      status: 'active',
      interactive: true,
      detail: {
        role: '零散關鍵字 → 標準技術',
        usage:
          '透過 tech_keyword 字典把零散關鍵字歸併到標準技術（tech），對應結果寫入 job_tech；tech_parent 維護技術之間的階層關係，供技術組合與分類分析。',
      },
    },
    {
      id: 'loc-group',
      label: '地點正規化',
      group: 'derive',
      status: 'active',
      interactive: true,
      detail: {
        role: '雜亂地點字串 → 地點群組',
        usage:
          'job.location 為來源平台的雜亂地點字串；透過 location_group_location 對應把它歸併到 location_group 地點群組，地點維度的彙總才能一致。',
      },
    },
    // ── 衍生資料表 ──
    {
      id: 'tbl-keyword',
      label: 'keyword 字典表',
      group: 'derived',
      status: 'active',
      interactive: true,
      detail: {
        role: '關鍵字字典＋次數',
        usage: '彙整後的關鍵字與出現次數，供技術熱度與映射使用。',
      },
    },
    {
      id: 'tbl-job-tech',
      label: 'job_tech 職缺×技術',
      group: 'derived',
      status: 'active',
      interactive: true,
      detail: {
        role: '職缺與技術的對應',
        usage: '技術排行與技術組合統計的連結基礎，把每筆職缺對應到一個或多個標準技術。',
      },
    },
    {
      id: 'tbl-location-group',
      label: 'location_group 地點群組',
      group: 'derived',
      status: 'active',
      interactive: true,
      detail: {
        role: '正規化後的地點群組',
        usage: '把雜亂地點歸併後的群組，供地點維度的職缺數彙總。',
      },
    },
    // ── 物化視圖 ──
    {
      id: 'mv-aggregate',
      label: '物化視圖彙總 mv_*',
      group: 'mv',
      status: 'active',
      interactive: true,
      detail: {
        role: '預先彙總並落地',
        usage:
          'mv_job 併入公司、正規化地點與技術陣列，並對「面議／以上」薪資補上市場加權推估；mv_tech_*、mv_location_group 等預先算好技術排行、技術組合與地點分布。分析頁讀取的是這些現成結果，而非即時掃描原始表。',
      },
    },
  ],
  views: {
    split: {
      id: 'split',
      title: '寫入時拆表',
      tiers: [['raw-job'], ['parse-salary', 'parse-keyword'], ['tbl-job', 'tbl-company', 'tbl-job-keyword']],
      clusterRows: [['raw'], ['cook'], ['fact']],
      edges: [
        { from: 'raw-job', to: 'parse-salary', label: '薪資字串' },
        { from: 'raw-job', to: 'parse-keyword', label: '職缺描述' },
        { from: 'raw-job', to: 'tbl-job', label: '標題／地點／描述' },
        { from: 'raw-job', to: 'tbl-company', label: '公司欄位' },
        { from: 'parse-salary', to: 'tbl-job', label: 'min/max／型態' },
        { from: 'parse-keyword', to: 'tbl-job-keyword', label: 'keywords[]／比例' },
      ],
    },
    process: {
      id: 'process',
      title: '事後加工',
      tiers: [
        ['tbl-job', 'tbl-job-keyword'],
        ['kw-dict', 'loc-group'],
        ['tech-map'],
        ['tbl-keyword', 'tbl-job-tech', 'tbl-location-group'],
        ['mv-aggregate'],
      ],
      clusterRows: [['fact'], ['derive'], ['derived'], ['mv']],
      edges: [
        { from: 'tbl-job-keyword', to: 'kw-dict', label: '展開聚合' },
        { from: 'tbl-job', to: 'loc-group', label: '地點字串' },
        { from: 'kw-dict', to: 'tbl-keyword', label: '寫入字典' },
        { from: 'kw-dict', to: 'tech-map', label: '字典為基底' },
        { from: 'tech-map', to: 'tbl-job-tech', label: '寫入對應' },
        { from: 'loc-group', to: 'tbl-location-group', label: '歸併群組' },
        { from: 'tbl-job', to: 'mv-aggregate', label: '事實彙總' },
        { from: 'tbl-job-tech', to: 'mv-aggregate', label: '技術彙總' },
        { from: 'tbl-location-group', to: 'mv-aggregate', label: '地點彙總' },
      ],
    },
  },
  defaultView: 'split',
};
