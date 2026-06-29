/**
 * 「資料來源與爬蟲」關係圖的唯一可信來源（content registry）。
 *
 * 以與「雲端與 CI/CD 架構」相同的模式呈現：節點依群組（資料來源／爬蟲引擎／處理管線／
 * 資料庫／執行模式）框起來，節點間以箭頭表達關係；多視角共用同一組節點：
 *  - 抓取流程・新增（flow）：來源 → 引擎 → 解析／擷取 → 正規化 → 批次寫入 → 資料庫。
 *  - 抓取流程・更新（recrawl）：挑選待更新職缺 → 重抓詳細頁 → 比對變動（有變動／無變動／
 *    職缺描述為空三向分岐）→ 批次寫回資料庫。
 *  - 執行模式（modes）：六種執行模式各自作用於引擎、詳細擷取或既有資料。
 *
 * 圖表、詳細面板與簡介文字皆只讀此模組，從根本保證各視角與文字版內容一致。
 * 內容對齊本專案實際的爬蟲行為（Crawlee PuppeteerCrawler、stealth 反爬、來源別解析、
 * 正規化、批次 upsert、列表頁進度與多種執行模式），僅職缺描述方法與架構。
 *
 * 安全：本檔僅職缺描述「方法與架構」層級，不含任何金鑰、憑證、連線字串或可重現受保護操作的設定。
 * 語系：zh-TW。
 */

export type CrawlerGroupId =
  | 'source'
  | 'engine'
  | 'list-pipeline'
  | 'list-pipeline-next'
  | 'detail-pipeline'
  | 'database'
  | 'mode'
  // 更新流程（re-crawl）專屬群組
  | 'rc-scope'
  | 'rc-detail'
  | 'rc-decide'
  | 'rc-write';
export type CrawlerViewId = 'flow' | 'recrawl';

// active=流程主幹；shared=被多種模式／流程共用的端點
export type CrawlerNodeStatus = 'active' | 'shared';

export interface CrawlerNode {
  readonly id: string; // 穩定 id，供 edge 與選取參照
  readonly label: string; // 顯示名稱（zh-TW）
  readonly group: CrawlerGroupId;
  readonly status: CrawlerNodeStatus;
  readonly interactive: boolean; // 是否可點看詳細
  readonly detail?: {
    // interactive 為 true 時必填（一致性測試強制）
    readonly role: string; // 在抓取流程中的角色
    readonly usage: string; // 用途說明；不得含機密
    readonly hostKey?: string; // 設定後，詳細面板會在 role 後附上該來源的「即時」職缺佔比（取自 get_job_host_statistics）
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
        role: ' headless 瀏覽器抓取引擎',
        usage:
          '以 Crawlee 的 PuppeteerCrawler 驅動 headless Chrome 抓取列表與詳細頁；採單一 Tab（maxConcurrency: 1）慢速抓取，一次只開一個頁面，避免對來源平台造成壓力。',
      },
    },
    {
      id: 'stealth',
      label: 'Stealth 反爬蟲',
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
          '首次執行時從資料庫一次性載入全部現有職缺 ID；之後逐筆比對，已存在者直接略過不進佇列，只有新職缺才排入詳細任務。',
      },
    },
    {
      id: 'list-enqueue',
      label: '建立任務（遞迴）',
      group: 'list-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '詳細任務 ＋ 下一頁任務（遞迴）',
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
      label: '解析詳細頁 HTML',
      group: 'detail-pipeline',
      status: 'active',
      interactive: true,
      detail: {
        role: '擷取職缺欄位',
        usage:
          '等待詳細頁就緒後，在瀏覽器內執行 evaluate 擷取標題、職缺描述、薪資、地點、公司等欄位；職缺描述為空視為職缺已下架，標記 closed。',
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
        role: '續抓機制・列表頁進度',
        usage:
          '續抓（resume）的核心：以 status（pending／completed／failed）記錄每個列表頁的處理進度。第 1 頁時依 pagination 一次預建好全部列表頁的 pending 紀錄，每頁完成即更新為 completed。下次啟動預設為續抓模式，直接撈出仍為 pending 的頁接續處理，不重跑已完成的頁，達成中斷後的斷點恢復；唯有 fresh 模式會先清空本表、從第 1 頁重建。',
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
        role: '重抓既有詳細頁',
        usage:
          '重新拜訪既有職缺的詳細頁，比對職缺描述、薪資、地點是否變動並就地更新；頁面已不存在則標記為已關閉（closed）。預設只挑「昨日之前未更新」者，使資料滾動更新。',
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
    // ── 更新流程（re-crawl）：重抓既有職缺詳細頁、比對變動、就地更新 ──
    {
      id: 'rc-scope',
      label: '挑選待更新職缺',
      group: 'rc-scope',
      status: 'active',
      interactive: true,
      detail: {
        role: '決定重抓範圍・續抓起點',
        usage:
          '預設只挑「昨日 00:00 之前未更新」的職缺，使資料滾動更新；也可帶 re-crawl=<條件> 縮小為指定單筆 id 或某段更新時間區間。撈出後依 min_salary 由高到低排序，逐筆重抓詳細頁。續抓機制：更新流程不使用 job_source 進度表，而是以職缺的 updated_at 為續抓依據——每批寫回即把已處理職缺的 updated_at 前移，故中斷後直接重跑，預設條件會自動排除今天已更新者、只接續處理剩下的職缺。',
      },
    },
    {
      id: 'rc-host',
      label: '依 host 選解析器',
      group: 'rc-detail',
      status: 'active',
      interactive: true,
      detail: {
        role: '判斷來源平台',
        usage:
          '依職缺 detail_link 的 host 選用 104 或 Cake 的解析器；遇到未知 host 則丟出錯誤並略過該筆，單筆失敗不中斷整體更新。',
      },
    },
    {
      id: 'rc-extract',
      label: '擷取詳細欄位',
      group: 'rc-detail',
      status: 'active',
      interactive: true,
      detail: {
        role: '取職缺描述／薪資／地點',
        usage: '等待詳細頁就緒後，在瀏覽器內執行 evaluate 擷取職缺描述、薪資、地點等欄位，交由下一步比對。',
      },
    },
    {
      id: 'rc-decide',
      label: '判斷職缺狀態',
      group: 'rc-decide',
      status: 'active',
      interactive: true,
      detail: {
        role: '看職缺描述是否為空 → 再看多個欄位是否變動',
        usage:
          '先看職缺描述是否為空；非空時再比對職缺描述、薪資、地點是否變動（薪資被手動標記者不覆蓋），據此決定走向「更新內容／僅刷新時間／標記為關閉職缺」三種結果之一。',
      },
    },
    {
      id: 'rc-update',
      label: '更新內容',
      group: 'rc-decide',
      status: 'active',
      interactive: true,
      detail: {
        role: '欄位有變動',
        usage:
          '職缺描述／薪資／地點任一變動 → 套用新值；薪資變動時一併重算 min／max，並以新職缺描述重算技術關鍵字。closed=false、updated_at 設為現在。',
      },
    },
    {
      id: 'rc-touch',
      label: '僅刷新時間',
      group: 'rc-decide',
      status: 'active',
      interactive: true,
      detail: {
        role: '欄位皆未變動',
        usage: '三個欄位皆未變動 → 只把 updated_at 更新為現在、closed=false，不重算關鍵字。',
      },
    },
    {
      id: 'rc-close',
      label: '標記為關閉',
      group: 'rc-decide',
      status: 'active',
      interactive: true,
      detail: {
        role: '頁面已下架',
        usage: '職缺描述為空視為職缺已下架 → closed=true，並更新 updated_at。',
      },
    },
    {
      id: 'rc-write',
      label: '批次寫回 DB',
      group: 'rc-write',
      status: 'active',
      interactive: true,
      detail: {
        role: '批次 upsert・落地續抓進度',
        usage:
          '三種結果都先推入待寫緩衝；每累積 20 筆即一次性 upsert（job，必要時連同 job_keyword）。全部跑完後由呼叫端再 flush 一次剩餘未滿批次的資料。續抓機制：因每 20 筆就落地、且寫回時 updated_at 前移，進度不會整批遺失——即使中途中斷，已寫回的職缺下次重跑就會被預設條件排除，等同從斷點接續。',
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
        ['list-api-intercept', 'list-filter', 'list-enqueue'],
        ['list-next'],
        ['detail-extractor'],
        ['normalizer'],
        ['batch-upsert'],
        ['db-job', 'db-job-source'],
      ],
      clusterRows: [['source'], ['engine'], ['list-pipeline'], ['detail-pipeline', 'list-pipeline-next'], ['database']],
      edges: [
        { from: 'src-104', to: 'crawler-engine', label: '列表 API' },
        { from: 'src-cake', to: 'crawler-engine', label: '列表 API' },
        { from: 'stealth', to: 'crawler-engine', label: '反爬・重試' },
        { from: 'crawler-engine', to: 'list-api-intercept', label: '列表頁' },
        { from: 'list-api-intercept', to: 'list-filter' },
        { from: 'list-filter', to: 'list-enqueue' },
        // 遞迴：下一頁任務指回攔截步驟
        { from: 'list-enqueue', to: 'list-next', label: '下一頁（遞迴）' },
        { from: 'list-enqueue', to: 'detail-extractor', label: '詳細任務' },
        { from: 'detail-extractor', to: 'normalizer' },
        { from: 'normalizer', to: 'batch-upsert' },
        { from: 'batch-upsert', to: 'db-job', label: '批次 upsert' },
        // 續抓機制：第 1 頁預建所有列表頁的 pending 紀錄，每頁完成即標 completed
        { from: 'list-enqueue', to: 'db-job-source', label: '記錄頁進度' },
        // 續抓機制：下次啟動時 resume 模式從 job_source 接手未完成（pending）的列表頁
        { from: 'db-job-source', to: 'list-api-intercept', label: '續抓 pending 頁' },
      ],
    },
    recrawl: {
      id: 'recrawl',
      title: '抓取流程(更新)',
      tiers: [
        ['rc-scope'],
        ['crawler-engine', 'stealth'],
        ['rc-host'],
        ['rc-extract'],
        ['rc-decide'],
        ['rc-update', 'rc-touch', 'rc-close'],
        ['rc-write'],
        ['db-job'],
      ],
      clusterRows: [['rc-scope'], ['engine'], ['rc-detail'], ['rc-decide'], ['rc-write'], ['database']],
      edges: [
        { from: 'rc-scope', to: 'crawler-engine', label: '逐筆重抓' },
        { from: 'stealth', to: 'crawler-engine', label: '反爬・重試' },
        { from: 'crawler-engine', to: 'rc-host', label: '開啟詳細頁' },
        { from: 'rc-host', to: 'rc-extract' },
        { from: 'rc-extract', to: 'rc-decide' },
        // 三向分岐：依職缺描述是否為空與是否變動
        { from: 'rc-decide', to: 'rc-update', label: '有變動' },
        { from: 'rc-decide', to: 'rc-touch', label: '無變動' },
        { from: 'rc-decide', to: 'rc-close', label: '職缺描述為空' },
        // 三種結果匯流回批次寫入
        { from: 'rc-update', to: 'rc-write' },
        { from: 'rc-touch', to: 'rc-write' },
        { from: 'rc-close', to: 'rc-write' },
        { from: 'rc-write', to: 'db-job', label: '批次 upsert' },
      ],
    },
  },
  defaultView: 'flow',
};
