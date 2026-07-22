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
  /** 清單頁載入後、等待清單 API 回應前,可選的額外等待邏輯。 */
  waitForListPage?: (page: Page) => Promise<void>;
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
 * `createCrawlRouter` 的回傳結果:可交給 Crawlee 使用的路由處理器,
 * 以及可在爬蟲收尾時呼叫、將尚未達批次大小的殘留項目強制送出的 `flushPending`。
 */
export interface CrawlRouterResult {
  router: RouterHandler;
  flushPending: () => Promise<void>;
}
