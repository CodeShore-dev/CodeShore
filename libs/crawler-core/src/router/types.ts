import type { Page } from 'puppeteer';
import type { RouterHandler } from 'crawlee';

/**
 * 通用爬蟲項目的最小形狀,所有清單頁擷取到的原始項目皆須至少具備 `id`。
 */
export interface CrawlItemBase {
  id: string;
}

/**
 * 需要進入詳情頁擷取的項目形狀。
 * 由引擎在清單頁比對 `resolveExisting()` 回傳的既有項目 Map 後補上
 * `existingItem`/`needToCreate`,交由呼叫端的 `transformItem`/`buildPersistItem` 使用。
 */
export interface RequireDetailCrawl<TExistingMeta> extends CrawlItemBase {
  title: string;
  url: string;
  existingItem: TExistingMeta | undefined;
  needToCreate: boolean;
}

/** 清單頁走訪完成或失敗的狀態。 */
export type ListPageStatus = 'completed' | 'failed';

/**
 * 清單頁狀態回報事件,於一個清單頁走訪完成或失敗時觸發,
 * 供呼叫端實作進度追蹤與可續傳邏輯(對應需求 3.8)。
 */
export interface ListPageResolvedEvent {
  url: string;
  page: number;
  totalPages: number;
  status: ListPageStatus;
  /**
   * 設為 `true` 時,`createSyncRouter` 的 `onListPageResolved` 跳過
   * `registerPendingPages` 的呼叫——用於 `clickToNextPage` 的 in-session 分頁
   * 模式:後續分頁在同一個瀏覽器 session 內點擊翻頁按鈕取得,不需要 Crawlee
   * 分別排入各分頁 URL 請求。
   */
  skipPendingPageRegistration?: boolean;
}

/**
 * 通用爬蟲路由引擎的設定物件,涵蓋所有注入式 callback。
 * 引擎本身不得預設任何網站專屬欄位命名或業務邏輯,所有判斷皆透過此設定物件由呼叫端提供。
 */
export interface CrawlRouterConfig<
  TListResponse,
  TRawItem extends CrawlItemBase,
  TDetail,
  TPersistItem,
  TExistingMeta,
> {
  /** 判斷某個攔截到的回應 URL 是否為清單 API 回應(對應需求 3.1)。 */
  matchListResponse: (url: string) => boolean;
  /** 等待清單 API 回應的逾時時間(毫秒)。預設 30000。 */
  listResponseTimeoutMs?: number;
  /** 清單 API 回應逾時後的最大重試次數。預設 10。 */
  maxListRetries?: number;
  /**
   * 清單頁載入後、設定回應監聽器之前執行的預備動作——例如點選篩選條件。
   * 這類動作會觸發多次中間 API 回應,必須在監聽器架設之前完成,以免監聽器
   * 提前捕捉到非最終結果的回應。動作完成後,引擎會立即對目前 URL 執行
   * `page.reload()`,以觸發乾淨的 API 呼叫供監聽器捕捉。
   */
  prepareListPage?: (page: Page) => Promise<void>;
  /** 清單頁載入後、等待清單 API 回應前,可選的額外等待邏輯。 */
  waitForListPage?: (page: Page) => Promise<void>;
  /**
   * 當提供此 callback 時,引擎改為 in-session 點擊翻頁:在同一個瀏覽器
   * session 內點擊「下一頁」按鈕取得後續分頁,而非把分頁 URL 排入 Crawlee
   * 請求佇列。回傳 `true` 表示已點擊且還有後續分頁,`false` 表示已無下一頁。
   */
  clickToNextPage?: (page: Page) => Promise<boolean>;
  /** 將清單 API 回應轉換為分頁中繼資訊,不假設任何特定欄位命名(對應需求 3.3)。 */
  parsePagination: (response: TListResponse) => {
    currentPage: number;
    totalPages: number;
    totalEntries: number;
  };
  /** 從清單 API 回應中擷取原始項目陣列。 */
  extractItems: (response: TListResponse) => TRawItem[];
  /** 可選的項目轉換函式,於引擎補上 `existingItem`/`needToCreate` 後呼叫。 */
  transformItem?: (
    item: TRawItem & RequireDetailCrawl<TExistingMeta>,
  ) => TRawItem & RequireDetailCrawl<TExistingMeta>;
  /** 解析既有項目集合,回傳以項目 id 為鍵的 Map,供引擎判斷 `needToCreate`(於單一引擎實例內記憶化)。 */
  resolveExisting: () => Promise<Map<string, TExistingMeta>>;
  /** 詳情頁擷取前需等待出現的選擇器(對應需求 3.5)。 */
  detailPageWaitSelector: string;
  /** 詳情頁選擇器出現後,於頁面 HTML 上執行的擷取函式。 */
  extractDetailOnHTML: () => TDetail | Promise<TDetail>;
  /**
   * 將原始項目與詳情資料組合為可持久化的項目形狀。
   * 回傳 `undefined` 時,引擎不會將該筆資料累積進批次佇列(對應需求 3.6)。
   */
  buildPersistItem: (
    item: TRawItem & RequireDetailCrawl<TExistingMeta>,
    detail: TDetail,
  ) => TPersistItem | undefined;
  /** 依清單回應決定本輪批次持久化的批次大小。預設 1。 */
  resolveBatchSize?: (response: TListResponse) => number;
  /** 待處理項目數量達到批次大小時觸發的批次持久化 callback(對應需求 3.6、3.7)。 */
  onBatchReady: (items: TPersistItem[]) => Promise<void>;
  /** 一個清單頁走訪完成或失敗時觸發的狀態回報 callback(對應需求 3.8)。 */
  onListPageResolved: (event: ListPageResolvedEvent) => Promise<void>;
  /** 可選的 logger,用於回報處理進度;未提供時使用預設的 console logger(對應需求 3.9)。 */
  logger?: {
    info: (msg: string) => void;
    warning: (msg: string) => void;
    error: (msg: string) => void;
  };
  /**
   * 同一個 job source 連續幾頁都沒有新項目(`needToCreate` 皆為 false)時,
   * 即放棄該 job source 剩餘分頁、跳到下一個 job source。預設 5。
   */
  maxConsecutiveEmptyListPages?: number;
  /**
   * 本次執行總共有幾個 job source,僅用於 log 顯示「第幾個 / 共幾個」,
   * 不提供時 log 僅顯示序號。
   */
  totalSourceCount?: number;
  /**
   * 以 job source 的 base URL(不含 page 參數,見 `getSourceKey`)為鍵,記錄
   * 該來源在這次執行「重新從第 1 頁爬」之前就已經追蹤到的最大分頁編號。
   *
   * 只要目前頁碼未超過這個下限,即使該頁沒有新職缺,也不計入
   * `maxConsecutiveEmptyListPages` 的連續空頁計數、也不會觸發放棄該來源——
   * 避免 fresh 模式重新驗證「上次已經抓過、這次自然沒有新職缺」的前段分頁時,
   * 被誤判為「已經抓到底」而提前放棄,連帶跳過上次尚未真正抓過、可能仍有新
   * 職缺的更深分頁。不提供時等同下限為 0(從第 1 頁起就套用一般判斷)。
   */
  knownPageFloors?: Map<string, number>;
}

/**
 * 一頁已由外部(如 computer use 輔助擷取的交接檔案)取得、尚未經過即時瀏覽器
 * 攔截的清單頁資料,供 `CrawlRouterResult.ingestCapturedListPage` 消化。
 */
export interface CapturedListPage<TRawItem extends CrawlItemBase> {
  /** 對應原始列表頁 URL(含分頁參數),供既有分頁進度追蹤機制辨識。 */
  url: string;
  currentPage: number;
  totalPages: number;
  totalEntries: number;
  /** 已正規化為本引擎既有 TRawItem 形狀的項目(完整或降級擷取皆須符合此形狀)。 */
  items: TRawItem[];
  /** 本次批次持久化的批次大小;未提供時預設為 items.length(一次性 flush)。 */
  batchSize?: number;
}

/**
 * 引擎主動呼叫 `crawler.stop()` 提早收工的原因。目前只有兩種:被限流
 * (HTTP 429)與被 Cloudflare 擋下(帶 Cloudflare 標頭的 403/503)。兩者都
 * 屬於「退讓一段時間再以 resume 模式重跑」即可撿回的情況。
 */
export type CrawlStopReasonKind = 'rate-limited' | 'cloudflare-blocked';

export interface CrawlStopReason {
  kind: CrawlStopReasonKind;
  /** 觸發停止的那個請求 URL(清單頁或詳情頁)。 */
  url: string;
  /** 觸發停止的 HTTP 狀態碼。 */
  status: number;
  /** 傳給 `crawler.stop()` 的訊息,同時作為 log 用的人類可讀描述。 */
  message: string;
}

/**
 * `createCrawlRouter` 的回傳結果:可交給 Crawlee 使用的路由處理器,
 * 以及可在爬蟲收尾時呼叫、將尚未達批次大小的殘留項目強制送出的 `flushPending`。
 *
 * `TRawItem` 預設為 `CrawlItemBase`,讓既有未明確標註型別引數的呼叫端
 * (如 `libs/sync-core` 的 `createSyncRouter` 回傳型別標註)在不修改的情況下
 * 依然可以編譯通過;`createCrawlRouter` 本身會以其自身固定的 `TRawItem`
 * 泛型引數具體實例化這個型別,讓 `ingestCapturedListPage` 在該呼叫端得到
 * 精確的項目型別。
 */
export interface CrawlRouterResult<
  TRawItem extends CrawlItemBase = CrawlItemBase,
> {
  router: RouterHandler;
  flushPending: () => Promise<void>;
  /**
   * 消化一頁已擷取的清單頁項目,跳過即時瀏覽器攔截,直接執行既有的
   * 既有/新增判斷、`transformItem`、DETAIL enqueue、清單頁完成狀態追蹤——
   * 與即時攔截路徑共用同一組記憶化狀態與完成計數器。
   *
   * 刻意宣告為屬性型別為函式(而非方法簡寫語法):方法簡寫語法在參數位置會
   * 退化為雙變數(bivariant)相容性檢查,讓不同 `TRawItem` 具體化的
   * `CrawlRouterResult<T>` 彼此可以互相賦值而不報錯——形同繞過了這個泛型
   * 引數存在的意義,讓例如 104 形狀的 `CapturedListPage` 能不安全地通過一個
   * 實際綁定 Cake 形狀 `TRawItem` 的呼叫端型別檢查。函式型別屬性在
   * `strictFunctionTypes` 下維持逆變(contravariant)檢查,才能讓
   * `TRawItem` 泛型引數真正發揮型別區分作用。唯一的既有呼叫端
   * `libs/sync-core` 的 `createSyncRouter` 因此需要把回傳型別標註同步改為
   * `CrawlRouterResult<TRawItem>`(而非留白退回預設的 `CrawlItemBase`),
   * 才能讓具體的 `TRawItem` 型別一路傳遞下去,而不是在推回程式碼庫時觸發
   * 逆變檢查失敗。
   */
  ingestCapturedListPage: (page: CapturedListPage<TRawItem>) => Promise<void>;
  /**
   * 取出(並清除)引擎最近一次主動 `crawler.stop()` 的原因。Crawlee 的
   * `crawler.run()` 被 stop 後仍會正常 resolve,呼叫端必須在 `run()` 結束後
   * 呼叫此函式才能分辨「爬完了」與「被限流 / 被擋而提早收工」,進而決定是否
   * 退讓後重試(見 `runWithRateLimitBackoff`)。沒有被 stop 過時回傳 `undefined`。
   */
  takeStopReason: () => CrawlStopReason | undefined;
}
