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

export type CrawlerGroupId =
  | 'source'
  | 'engine'
  | 'list-pipeline'
  | 'list-pipeline-next'
  | 'detail-pipeline'
  | 'database'
  | 'mode';
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
    readonly hostKey?: string; // 設定後，詳情面板會在 role 後附上該來源的「即時」職缺佔比（取自 get_job_host_statistics）
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
        role: '公開職缺來源',
        usage: '從 /jobs/search/api/jobs API 取得資料',
        hostKey: '104.com.tw',
      },
    },
    {
      id: 'src-cake',
      label: 'Cake',
      group: 'source',
      status: 'active',
      interactive: true,
      detail: {
        role: '公開職缺來源',
        usage: '從 /api/client/v1/jobs/search API 取得資料',
        hostKey: 'cake.me',
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
        usage:
          '以 Crawlee 的 PuppeteerCrawler 驅動無頭 Chrome 抓取列表與詳情頁；採單一 Tab（maxConcurrency: 1）慢速抓取，一次只開一個頁面，避免對來源平台造成壓力。',
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
          'puppeteer-extra stealth 搭配 rebrowser-puppeteer，貼近真實瀏覽器的視窗大小、語系與請求標頭；列表回應採逾時控制與多次重試，單頁失敗不中斷整體。',
      },
    },
    {
      id: 'list-api-intercept',
      label: '攔截列表 API',
      group: 'list-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '取得本頁職缺與分頁資訊',
        usage:
          '監聽瀏覽器 XHR/Fetch 回應，攔截符合來源格式的列表 API；解析 pagination（目前頁／總頁數／總筆數）。最多重試 10 次、每次逾時 30 秒；重試時重載頁面，失敗不中斷整體。',
      },
    },

    {
      id: 'list-filter',
      label: '過濾既有職缺',
      group: 'list-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '排除資料庫中已有的職缺',
        usage:
          '首次執行時從資料庫一次性載入全部現有職缺 ID；之後逐筆比對，已存在者直接略過不進佇列，只有新職缺才排入詳情任務。',
      },
    },
    {
      id: 'list-enqueue',
      label: '建立任務（遞迴）',
      group: 'list-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '詳情任務 ＋ 下一頁任務（遞迴）',
        usage:
          '每筆新職缺以高優先度各自建立 DETAIL 任務；以低優先度建立下一頁的 LIST 任務，形成自我遞迴直到末頁。第 1 頁時，利用 pagination 資訊在資料表先預建好全部列表頁的待完成紀錄（以供斷點恢復使用），之後每頁完成後會更新該頁紀錄的狀態。',
      },
    },
    {
      id: 'list-next',
      label: '流程同上並繼續往下遞迴',
      group: 'list-pipeline-next',
      status: 'active',
      interactive: false,
      detail: {
        role: '',
        usage: '',
      },
    },
    {
      id: 'detail-extractor',
      label: '解析詳情頁 HTML',
      group: 'detail-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '擷取職缺欄位',
        usage:
          '等待詳情頁就緒後，在瀏覽器內執行 evaluate 擷取標題、描述、薪資、地點、公司等欄位；描述為空視為職缺已下架，標記 closed。',
      },
    },
    {
      id: 'normalizer',
      label: '正規化',
      group: 'detail-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '統一資料結構',
        usage: '把不同來源的欄位正規化為一致的職缺資料結構，後續分析才能跨來源一致處理。細節會在別區說明。',
      },
    },
    {
      id: 'batch-upsert',
      label: '批次緩衝區 → DB',
      group: 'detail-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '批次寫入資料庫',
        usage:
          '正規化後的公司、職缺、關鍵字先各自推入待寫緩衝；達到批次大小（依來源每頁筆數調整）即一次性 upsert 至資料庫，降低寫入次數。爬蟲結束後由呼叫端手動 flush 剩餘未滿批次的資料。',
      },
    },
    {
      id: 'db-job',
      label: 'job / company / job_keyword 資料表',
      group: 'database',
      status: 'shared',
      interactive: true,
      detail: {
        role: '職缺事實資料',
        usage: '正規化後寫入此三張表，它們是所有分析的事實來源。',
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
      title: '抓取流程(新增)',
      tiers: [
        ['src-104', 'src-cake'],
        ['crawler-engine', 'stealth'],
        ['list-api-intercept', 'list-next'],
        ['list-filter'],
        ['list-enqueue'],
        ['detail-extractor'],
        ['normalizer'],
        ['batch-upsert'],
        ['db-job'],
      ],
      clusterRows: [['source'], ['engine'], ['list-pipeline', 'list-pipeline-next'], ['detail-pipeline'], ['database']],
      edges: [
        { from: 'src-104', to: 'crawler-engine', label: '列表 API' },
        { from: 'src-cake', to: 'crawler-engine', label: '列表 API' },
        { from: 'stealth', to: 'crawler-engine', label: '反爬・重試' },
        { from: 'crawler-engine', to: 'list-api-intercept', label: '列表頁' },
        { from: 'list-api-intercept', to: 'list-filter' },
        { from: 'list-filter', to: 'list-enqueue' },
        // 遞迴：下一頁任務指回攔截步驟
        { from: 'list-enqueue', to: 'list-next', label: '下一頁（遞迴）' },
        { from: 'list-enqueue', to: 'detail-extractor', label: '詳情任務' },
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
      clusterRows: [['mode'], ['engine', 'detail-pipeline', 'database']],
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
