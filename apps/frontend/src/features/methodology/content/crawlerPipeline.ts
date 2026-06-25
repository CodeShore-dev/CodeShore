/**
 * 「資料來源與爬蟲」關係圖的唯一可信來源（content registry）。
 *
 * 以與「雲端與 CI/CD 架構」相同的模式呈現：節點依群組（資料來源／爬蟲引擎／處理管線／
 * 資料庫／執行模式）框起來，節點間以箭頭表達關係；雙視角共用同一組節點：
 *  - 抓取流程（flow）：來源 → 引擎 → 解析／擷取 → 正規化 → 批次寫入 → 資料庫。
 *  - 執行模式（modes）：六種執行模式各自作用於引擎、詳情擷取或既有資料。
 *
 * 圖表、詳情面板與簡介文字皆只讀此模組，從根本保證雙視角與文字版內容一致。
 * 內容對齊本專案實際的爬蟲行為（Crawlee PuppeteerCrawler、stealth 反爬、來源別解析、
 * 正規化、批次 upsert、列表頁進度與多種執行模式），僅描述方法與架構。
 *
 * 安全：本檔僅描述「方法與架構」層級，不含任何金鑰、憑證、連線字串或可重現受保護操作的設定。
 * 語系：zh-TW。
 */

export type CrawlerGroupId = 'source' | 'engine' | 'pipeline' | 'database' | 'mode';
export type CrawlerViewId = 'flow' | 'modes';

// active=流程主幹；shared=被多種模式／流程共用的端點
export type CrawlerNodeStatus = 'active' | 'shared';

export interface CrawlerNode {
  readonly id: string; // 穩定 id，供 edge 與選取參照
  readonly label: string; // 顯示名稱（zh-TW）
  readonly group: CrawlerGroupId;
  readonly status: CrawlerNodeStatus;
  readonly interactive: boolean; // 是否可點看詳情
  readonly detail?: {
    // interactive 為 true 時必填（一致性測試強制）
    readonly role: string; // 在抓取流程中的角色
    readonly usage: string; // 用途說明；不得含機密
  };
}

export interface CrawlerEdge {
  readonly from: string; // CrawlerNode.id
  readonly to: string; // CrawlerNode.id
  readonly label?: string; // 關係標註
}

export interface CrawlerView {
  readonly id: CrawlerViewId;
  readonly title: string; // 如「抓取流程」「執行模式」
  readonly tiers: readonly (readonly string[])[]; // 分層順序，每層為 node id 陣列
  readonly clusterRows: readonly (readonly CrawlerGroupId[])[]; // 群組框由上而下的流程列排列
  readonly edges: readonly CrawlerEdge[];
}

export interface CrawlerPipeline {
  readonly nodes: readonly CrawlerNode[]; // 雙視角共享節點集
  readonly views: Readonly<Record<CrawlerViewId, CrawlerView>>;
  readonly defaultView: CrawlerViewId;
}

export const crawlerPipeline: CrawlerPipeline = {
  nodes: [
    {
      id: 'src-104',
      label: '104 人力銀行',
      group: 'source',
      status: 'active',
      interactive: true,
      detail: {
        role: '公開職缺來源（約佔 54%）',
        usage: '以列表 API 取得職缺清單、再抓取詳情頁。本站做完分析後把使用者導回原平台投遞，不收履歷、不做媒合。',
      },
    },
    {
      id: 'src-cake',
      label: 'Cake',
      group: 'source',
      status: 'active',
      interactive: true,
      detail: {
        role: '公開職缺來源（約佔 28%）',
        usage: '另一個公開職缺平台，與 104 各以專屬的列表解析器與詳情擷取器處理。',
      },
    },
    {
      id: 'crawler-engine',
      label: 'Crawlee PuppeteerCrawler',
      group: 'engine',
      status: 'active',
      interactive: true,
      detail: {
        role: '無頭瀏覽器抓取引擎',
        usage: '以 Crawlee 的 PuppeteerCrawler 驅動無頭 Chrome 抓取列表與詳情頁；採單一併發以減輕對來源的壓力。',
      },
    },
    {
      id: 'stealth',
      label: 'Stealth 反爬層',
      group: 'engine',
      status: 'active',
      interactive: true,
      detail: {
        role: '反自動化偵測與穩定性',
        usage:
          'puppeteer-extra stealth 搭配 rebrowser-puppeteer，貼近真實瀏覽器的視窗大小、語系與請求標頭；列表回應採逾時控制與多次重試，單頁失敗不中斷整體並標記為 failed。',
      },
    },
    {
      id: 'list-parser',
      label: '列表解析器',
      group: 'pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '來源列表 API 解析',
        usage:
          '依來源（104／Cake）各自解析列表頁，並先載入既有職缺 id 做比對：只有「新職缺」才排入詳情佇列，既有職缺交由更新模式處理。',
      },
    },
    {
      id: 'detail-extractor',
      label: '詳情頁擷取器',
      group: 'pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '職缺詳情擷取',
        usage: '抓取單一職缺詳情頁，擷取標題、描述、薪資、地點、公司等欄位。',
      },
    },
    {
      id: 'normalizer',
      label: '正規化',
      group: 'pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '統一資料結構',
        usage: '把不同來源的欄位正規化為一致的職缺資料結構，後續分析才能跨來源一致處理。',
      },
    },
    {
      id: 'batch-upsert',
      label: '批次 Upsert',
      group: 'pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '批次寫入資料庫',
        usage: '詳情資料批次累積後一次性 upsert（批次大小依來源每頁筆數調整），降低資料庫寫入次數。',
      },
    },
    {
      id: 'db-job',
      label: 'job 職缺資料表',
      group: 'database',
      status: 'shared',
      interactive: true,
      detail: {
        role: '職缺事實資料',
        usage: '正規化後的職缺寫入處，是所有分析的事實來源；離線重算模式（薪資／關鍵字）也直接讀寫此表。',
      },
    },
    {
      id: 'db-job-source',
      label: 'job_source 抓取進度',
      group: 'database',
      status: 'shared',
      interactive: true,
      detail: {
        role: '列表頁抓取進度',
        usage: '以 status（pending／completed／failed）記錄各列表頁的處理進度，供續抓模式接手 pending、達成斷點恢復。',
      },
    },
    {
      id: 'mode-fresh',
      label: '全量 fresh',
      group: 'mode',
      status: 'active',
      interactive: true,
      detail: {
        role: '重新建立待抓清單',
        usage: '從第 1 頁起掃過來源平台所有列表頁，適用於初次建置或大規模重建。',
      },
    },
    {
      id: 'mode-resume',
      label: '續抓 resume',
      group: 'mode',
      status: 'active',
      interactive: true,
      detail: {
        role: '預設模式・斷點恢復',
        usage: '沿用資料庫中尚未完成（pending）的列表頁清單接續抓取，中斷後可從斷點恢復，不重複處理已完成的頁。',
      },
    },
    {
      id: 'mode-recrawl',
      label: '更新 re-crawl',
      group: 'mode',
      status: 'active',
      interactive: true,
      detail: {
        role: '重訪既有詳情頁',
        usage:
          '重新拜訪既有職缺的詳情頁，比對描述、薪資、地點是否變動並就地更新；頁面已不存在則標記為已關閉（closed）。預設只挑「昨日之前未更新」者，使資料滾動更新。',
      },
    },
    {
      id: 'mode-recrawl-cond',
      label: '條件更新',
      group: 'mode',
      status: 'active',
      interactive: true,
      detail: {
        role: '縮小更新範圍',
        usage: '更新模式可帶查詢條件（如指定單筆 id 或某段更新時間區間），只重抓符合條件的職缺。',
      },
    },
    {
      id: 'mode-salary',
      label: '薪資重算 job-salary',
      group: 'mode',
      status: 'active',
      interactive: true,
      detail: {
        role: '離線重算薪資',
        usage: '不重新連線抓取，直接對既有職缺的薪資字串重新解析出 min／max 與薪資型態（手動標記過的薪資則略過）。',
      },
    },
    {
      id: 'mode-keyword',
      label: '關鍵字重算 job-keyword',
      group: 'mode',
      status: 'active',
      interactive: true,
      detail: {
        role: '離線重萃技術關鍵字',
        usage: '不重新連線抓取，針對既有職缺描述以最新的技術字典重新萃取技術關鍵字。',
      },
    },
  ],
  views: {
    flow: {
      id: 'flow',
      title: '抓取流程',
      tiers: [
        ['src-104', 'src-cake'],
        ['crawler-engine', 'stealth'],
        ['list-parser', 'detail-extractor'],
        ['normalizer'],
        ['batch-upsert'],
        ['db-job', 'db-job-source'],
      ],
      clusterRows: [['source'], ['engine'], ['pipeline'], ['database']],
      edges: [
        { from: 'src-104', to: 'crawler-engine', label: '列表 API' },
        { from: 'src-cake', to: 'crawler-engine', label: '列表 API' },
        { from: 'stealth', to: 'crawler-engine', label: '反爬・重試' },
        { from: 'crawler-engine', to: 'list-parser', label: '列表頁' },
        { from: 'list-parser', to: 'detail-extractor', label: '新職缺・詳情佇列' },
        { from: 'list-parser', to: 'db-job-source', label: '頁面進度' },
        { from: 'detail-extractor', to: 'normalizer' },
        { from: 'normalizer', to: 'batch-upsert' },
        { from: 'batch-upsert', to: 'db-job', label: '批次 upsert' },
      ],
    },
    modes: {
      id: 'modes',
      title: '執行模式',
      tiers: [
        ['mode-fresh', 'mode-resume', 'mode-recrawl', 'mode-recrawl-cond', 'mode-salary', 'mode-keyword'],
        ['crawler-engine', 'detail-extractor', 'db-job'],
      ],
      clusterRows: [['mode'], ['engine', 'pipeline', 'database']],
      edges: [
        { from: 'mode-fresh', to: 'crawler-engine', label: '全量重抓' },
        { from: 'mode-resume', to: 'crawler-engine', label: '接續 pending' },
        { from: 'mode-recrawl', to: 'detail-extractor', label: '重訪詳情' },
        { from: 'mode-recrawl-cond', to: 'detail-extractor', label: '條件子集' },
        { from: 'mode-salary', to: 'db-job', label: '離線重算薪資' },
        { from: 'mode-keyword', to: 'db-job', label: '離線重算關鍵字' },
      ],
    },
  },
  defaultView: 'flow',
};
