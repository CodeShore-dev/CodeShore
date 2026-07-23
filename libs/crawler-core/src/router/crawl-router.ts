import { RequestQueue, createPuppeteerRouter } from 'crawlee';
import type { HTTPResponse, Page } from 'puppeteer';

import { createBatchAccumulator } from '../progress/batch-accumulator';
import { withErrorIsolation } from '../progress/error-isolation';
import { createRollingAverageTracker } from '../progress/rolling-average';
import { formatDuration } from '../time';
import {
  generateNextUrlToEnqueue,
  getPageIndex,
  getSourceKey,
} from '../url';
import type {
  CrawlItemBase,
  CrawlRouterConfig,
  CrawlRouterResult,
  RequireDetailCrawl,
} from './types';

const DEFAULT_LIST_RESPONSE_TIMEOUT_MS = 30000;
const DEFAULT_MAX_LIST_RETRIES = 10;
const DEFAULT_MAX_CONSECUTIVE_EMPTY_LIST_PAGES = 5;

const defaultLogger = {
  info: (msg: string) => console.log(msg),
  warning: (msg: string) => console.warn(msg),
  error: (msg: string) => console.error(msg),
};

/**
 * 標記「清單 API 回應是 HTTP 429(被限流)」的專用例外:與逾時等其他攔截失敗
 * 原因區分開來,讓 `interceptListResponse` 立刻放棄重試(重試只會換來更多
 * 429),並讓呼叫端(`createCrawlRouter`)可以特別處理——停止整個爬蟲,而不是
 * 走一般的「這頁失敗」回報路徑。
 */
class RateLimitedError extends Error {
  constructor(url: string) {
    super(`Rate limited (HTTP 429) on ${url}`);
    this.name = 'RateLimitedError';
  }
}

/**
 * 標記「被 Cloudflare 擋下(直接 403 封鎖或 503 challenge 頁)」的專用例外:
 * 與逾時等其他攔截失敗原因區分開來,讓 `interceptListResponse` 立刻放棄重試
 * (重試只會在同一個已被標記的 session 上再次撞牆),並讓呼叫端可以比照
 * `RateLimitedError` 的方式——停止整個爬蟲、讓該頁維持可續爬狀態。
 */
class CloudflareBlockedError extends Error {
  constructor(url: string, status: number) {
    super(`Blocked by Cloudflare (HTTP ${status}) on ${url}`);
    this.name = 'CloudflareBlockedError';
  }
}

/**
 * 判斷一個 HTTP 回應是否為 Cloudflare 的攔截頁(直接封鎖或 challenge)。
 * 403/503 本身在一般後端也可能發生(暫時性故障、權限問題等),單看狀態碼容易
 * 誤判,因此額外要求 Cloudflare 特有的回應標頭(`server: cloudflare` 或
 * `cf-mitigated`)其中之一出現,才視為 Cloudflare 攔截——避免把單純的後端
 * 5xx/403 誤判成「被擋」而不必要地中止整個 crawl run。
 */
function isCloudflareBlockResponse(res: {
  status(): number;
  headers(): Record<string, string>;
}): boolean {
  const status = res.status();
  if (status !== 403 && status !== 503) return false;
  const headers = res.headers();
  const server = (headers['server'] ?? headers['Server'] ?? '').toLowerCase();
  const cfMitigated = headers['cf-mitigated'] ?? headers['Cf-Mitigated'];
  return server === 'cloudflare' || Boolean(cfMitigated);
}

/**
 * 攔截清單頁的 API 回應,並在逾時未攔截到符合條件的回應時,依 `maxListRetries`
 * 重新載入頁面重試。符合條件的判斷結合呼叫端注入的 `matchListResponse(url)`
 * 與引擎固定的 `method() !== 'OPTIONS'`、`status() === 200` 檢查(此兩項不對外開放客製化)。
 * 若攔截到的回應是 HTTP 429,視為被限流,立即以 `RateLimitedError` 中止、不重試。
 *
 * 對應原 `apps/crawler/src/handler.ts` L147-208 的重試迴圈,保留其
 * `Promise.race` 逾時競爭與 `page.on`/`page.off` 監聽器清理紀律。
 */
async function interceptListResponse<TListResponse>(
  page: Page,
  options: {
    matchListResponse: (url: string) => boolean;
    listResponseTimeoutMs?: number;
    maxListRetries?: number;
    waitForListPage?: (page: Page) => Promise<void>;
    logger?: {
      info: (msg: string) => void;
      warning: (msg: string) => void;
      error: (msg: string) => void;
    };
  },
): Promise<TListResponse> {
  const timeoutMs =
    options.listResponseTimeoutMs ?? DEFAULT_LIST_RESPONSE_TIMEOUT_MS;
  const maxRetries = options.maxListRetries ?? DEFAULT_MAX_LIST_RETRIES;
  const log = options.logger ?? defaultLogger;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let responseHandler!: (res: HTTPResponse) => void;

    const waitForListResponse = new Promise<TListResponse>((resolve, reject) => {
      responseHandler = res => {
        const req = res.request();
        const url = res.url();
        if (options.matchListResponse(url) && req.method() !== 'OPTIONS') {
          if (res.status() === 429) {
            reject(new RateLimitedError(url));
            return;
          }
          if (isCloudflareBlockResponse(res)) {
            reject(new CloudflareBlockedError(url, res.status()));
            return;
          }
          if (res.status() === 200) {
            res
              .json()
              .then(json => resolve(json as TListResponse))
              .catch(error => {
                log.error(`Failed to parse list response JSON: ${error}`);
              });
          }
        }
      };
      page.on('response', responseHandler);
    });

    try {
      if (attempt > 1) {
        log.warning(`Retry ${attempt}/${maxRetries} for list response`);
        await page.reload();
      }
      if (options.waitForListPage) {
        await options.waitForListPage(page).catch(() => undefined);
      }

      const response = await Promise.race([
        waitForListResponse,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout waiting for list API response')),
            timeoutMs,
          ),
        ),
      ]);
      page.off('response', responseHandler);
      return response;
    } catch (error) {
      page.off('response', responseHandler);
      // 被限流或被 Cloudflare 擋下時都不重試:重試只會立刻在同一個已被標記的
      // session 上再次撞牆,徒增對目標站台的壓力。
      if (error instanceof RateLimitedError) throw error;
      if (error instanceof CloudflareBlockedError) throw error;
      lastError = error;
      if (attempt === maxRetries) throw error;
    }
  }

  // Unreachable: the loop above always either returns or throws on the last
  // attempt, but TypeScript can't infer that without this fallback.
  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to intercept list API response');
}

const DEFAULT_DETAIL_WAIT_SELECTOR_TIMEOUT_MS = 10000;

// 供 `withErrorIsolation` 包裝清單頁 try body 使用的成功哨兵值:body 本身無
// 有意義的回傳值(純副作用),用一個模組層級的唯一 Symbol 區分「body 正常
// 執行完畢」與「body 拋出例外、被 withErrorIsolation 攔截後回傳 undefined」
// 這兩種情況,藉此保留原本 catch 區塊呼叫 `config.onListPageResolved` 回報
// 失敗狀態的 follow-up 邏輯。
const LIST_PAGE_SUCCESS = Symbol('list-page-success');

// DETAIL 請求的 `userData` 內部用來回指其所屬清單頁 URL 的欄位名稱,供
// `maybeCompleteListPage` 判斷該清單頁的 DETAIL 請求是否都已處理完畢。
const LIST_PAGE_URL_USERDATA_KEY = '__listPageUrl';

/**
 * 建立通用清單/詳情爬蟲路由引擎。
 *
 * 此為任務 3.2-3.5 的實作切片:清單頁 API 回應攔截與可設定的逾時/重試邏輯
 * (對應需求 3.1、3.2),分頁中繼資訊解析、原始項目擷取、既有項目查找
 * (單一引擎實例生命週期內記憶化)、詳情頁加入佇列的判斷、清單頁完成/失敗
 * 狀態回報(對應需求 3.3、3.4、3.8),詳情頁走訪(等待選擇器、擷取、建構
 * 持久化項目)與批次累積/持久化,含收尾用的 `flushPending`(對應需求 3.5、
 * 3.6、3.7),以及清單頁/詳情頁的進度追蹤與 ETA 預估、透過 `config.logger`
 * 輸出(對應需求 3.9,完整比照原 `apps/crawler/src/handler.ts` L92-111、
 * L296-380 的 rolling-average 與 ETA 算法)。清單頁與詳情頁的處理各自完整
 * 包在 try/catch 中:任一項目處理失敗時,僅透過 `config.logger.error` 記錄
 * 錯誤並繼續處理下一個請求,不會讓整個 crawl run 中斷——此為引擎固定行為,
 * 不透過設定開放客製化(對應 6.1 行為零回歸)。
 */
export function createCrawlRouter<
  TListResponse,
  TRawItem extends CrawlItemBase,
  TDetail,
  TPersistItem,
  TExistingMeta,
>(
  config: CrawlRouterConfig<
    TListResponse,
    TRawItem,
    TDetail,
    TPersistItem,
    TExistingMeta
  >,
): CrawlRouterResult {
  const log = config.logger ?? defaultLogger;
  const puppeteerRouter = createPuppeteerRouter();

  // 批次持久化累積佇列與門檻,對應需求 3.6、3.7。門檻(`batchSize`)由清單頁
  // 走訪時經由 `config.resolveBatchSize(response)` 算出後存入此 closure 變數,
  // 供後續同一輪清單頁下所有 DETAIL 請求共用讀取——比照原 `apps/crawler/src/
  // handler.ts` 的 `let batchSize = 1;` closure 共享模式(該值於引擎生命週期內
  // 為單一清單頁走訪的最新結果,非逐頁重置為初始值,亦與原實作行為一致)。
  // 累積/門檻檢查/flush 機制改用共用的 `createBatchAccumulator`;`batchSize`
  // closure 變數本身仍由清單頁 handler 重新賦值,accumulator 透過
  // `resolveBatchSize` 每次 push 時重新讀取最新值,行為與原本一致。
  let batchSize = 1;
  const batchAccumulator = createBatchAccumulator<TPersistItem>({
    resolveBatchSize: () => batchSize,
    onFlush: config.onBatchReady,
  });
  const flushPending = (): Promise<void> => batchAccumulator.flushRemaining();

  // 記憶化 `resolveExisting()`:於此 `createCrawlRouter` 實例生命週期內僅執行
  // 一次,後續每個清單頁處理皆重用同一個已 resolve 的 Promise(對應 design.md
  // 「resolveExisting 記憶化」段落;快取範圍限定在單一引擎實例,不是模組層級全域)。
  let existingMetaPromise: Promise<Map<string, TExistingMeta>> | undefined;
  const resolveExistingMemoized = (): Promise<Map<string, TExistingMeta>> => {
    if (!existingMetaPromise) {
      existingMetaPromise = config.resolveExisting();
    }
    return existingMetaPromise;
  };

  // 進度/ETA 追蹤用的 closure 狀態,對應需求 3.9,完整比照原 `handler.ts`
  // L83-111 的 rolling-average 與 ETA 算法(變數命名亦刻意保持一致以利對照)。
  // 這些狀態於單一 `createCrawlRouter` 實例生命週期內累積,不對外匯出。
  // 清單頁、詳情頁各自的滾動平均改用共用的 `createRollingAverageTracker`——
  // 兩階段的 tracker 各自獨立(不合併),因為下方 `estimateFinishTime` 的
  // 兩階段 ETA 合成公式需要各自的 average/count,此公式本身維持私有、不泛化
  // (design.md Non-Goals)。
  const listPageTracker = createRollingAverageTracker();
  const detailPageTracker = createRollingAverageTracker();
  let totalDetailPages = 0;
  let processedDetailPages = 0;
  let lastKnownListPage = 0;
  let lastKnownTotalListPages = 1;

  // 「連續 N 頁都沒有新項目就跳過此 job source」的追蹤狀態,以 job source 的
  // base URL(不含 page 參數)為鍵。`seenSourceKeys` 依「第一次遇到」的順序
  // 記錄各 job source,用於 log 呈現「第幾個 / 共幾個 job source」。
  const maxConsecutiveEmptyListPages =
    config.maxConsecutiveEmptyListPages ??
    DEFAULT_MAX_CONSECUTIVE_EMPTY_LIST_PAGES;
  const consecutiveEmptyPagesBySource = new Map<string, number>();
  const skippedSources = new Set<string>();
  const seenSourceKeys: string[] = [];

  const describeSourceProgress = (sourceKey: string): string => {
    let index = seenSourceKeys.indexOf(sourceKey);
    if (index === -1) {
      seenSourceKeys.push(sourceKey);
      index = seenSourceKeys.length - 1;
    }
    const ordinal = index + 1;
    return config.totalSourceCount
      ? `job source ${ordinal}/${config.totalSourceCount}`
      : `job source ${ordinal}`;
  };

  // 清單頁「標記完成」的時機延後到「該頁所有 DETAIL 請求都已處理完畢」之後,
  // 而非清單頁一解析完就馬上標記——否則若爬蟲在清單頁標記完成後、對應 DETAIL
  // 頁尚未爬完前中斷,該頁不會再被續爬撿回,漏爬的職缺詳情就永久遺失了。
  // 以清單頁 URL 為鍵,記錄還剩幾個 DETAIL 請求待處理。
  const pendingListPageCompletions = new Map<
    string,
    { page: number; totalPages: number; remaining: number }
  >();

  const maybeCompleteListPage = async (listPageUrl: string): Promise<void> => {
    const pending = pendingListPageCompletions.get(listPageUrl);
    if (!pending || pending.remaining > 0) return;
    pendingListPageCompletions.delete(listPageUrl);
    await config.onListPageResolved({
      url: listPageUrl,
      page: pending.page,
      totalPages: pending.totalPages,
      status: 'completed',
    });
  };

  const estimateFinishTime = (): string => {
    const avgList = listPageTracker.getAverage();
    const avgDetail = detailPageTracker.getAverage();
    const remainingList = lastKnownTotalListPages - lastKnownListPage;
    const projectedTotalDetail =
      lastKnownListPage > 0
        ? Math.round(
            (totalDetailPages / lastKnownListPage) * lastKnownTotalListPages,
          )
        : totalDetailPages;
    const remainingDetail = Math.max(
      0,
      projectedTotalDetail - processedDetailPages,
    );
    const etaMs = remainingList * avgList + remainingDetail * avgDetail;
    return formatDuration(etaMs);
  };

  puppeteerRouter.addDefaultHandler(async ({ request, page, enqueueLinks, response, crawler }) => {
    const sourceKey = getSourceKey(request.url);
    const sourceProgress = describeSourceProgress(sourceKey);

    // 被限流(HTTP 429):不管是外層頁面本身還是後續攔截到的清單 API 回應,
    // 都直接停掉整個爬蟲、不重試、不動這頁在 DB 的狀態——讓它保持原狀
    // (通常是 pending),下次執行自然會續爬撿回來。
    if (response?.status() === 429) {
      log.error(
        `Rate limited (HTTP 429) while loading ${request.url} (${sourceProgress}). ` +
          `Stopping the crawl run to back off — this page stays resumable on the next run.`,
      );
      crawler.stop(`Rate limited (HTTP 429) on ${request.url}`);
      return;
    }

    // 被 Cloudflare 擋下(直接 403 封鎖或 503 challenge 頁):比照 429 的處理
    // 方式,直接停掉整個爬蟲、不動這頁在 DB 的狀態,留給下次執行續爬——單一
    // session 一旦被 Cloudflare 標記,同一輪繼續重試只會撞到更多攔截頁。
    if (response && isCloudflareBlockResponse(response)) {
      log.error(
        `Blocked by Cloudflare (HTTP ${response.status()}) while loading ${request.url} ` +
          `(${sourceProgress}). Stopping the crawl run to back off — this page stays ` +
          `resumable on the next run.`,
      );
      crawler.stop(`Blocked by Cloudflare on ${request.url}`);
      return;
    }

    if (skippedSources.has(sourceKey)) {
      log.info(
        `Skipping ${request.url} — ${sourceProgress} already exhausted ` +
          `(${maxConsecutiveEmptyListPages} consecutive pages with no new jobs), moving on.`,
      );
      const skippedPage = parseInt(getPageIndex(request.url) || '1');
      await config.onListPageResolved({
        url: request.url,
        page: skippedPage,
        totalPages: skippedPage,
        status: 'completed',
      });
      return;
    }

    log.info(`Processing: ${request.url} (${sourceProgress})`);
    const pageStart = Date.now();

    let listResponse: TListResponse;
    try {
      listResponse = await interceptListResponse<TListResponse>(page, {
        matchListResponse: config.matchListResponse,
        listResponseTimeoutMs: config.listResponseTimeoutMs,
        maxListRetries: config.maxListRetries,
        waitForListPage: config.waitForListPage,
        logger: config.logger,
      });
    } catch (error) {
      if (error instanceof RateLimitedError) {
        log.error(
          `Rate limited (HTTP 429) while waiting for the list API response on ` +
            `${request.url} (${sourceProgress}). Stopping the crawl run to back off — ` +
            `this page stays resumable on the next run.`,
        );
        crawler.stop(`Rate limited (HTTP 429) on ${request.url}`);
        return;
      }
      if (error instanceof CloudflareBlockedError) {
        log.error(
          `${error.message} while waiting for the list API response on ` +
            `${request.url} (${sourceProgress}). Stopping the crawl run to back off — ` +
            `this page stays resumable on the next run.`,
        );
        crawler.stop(error.message);
        return;
      }
      throw error;
    }

    log.info(`Intercepted list response for: ${request.url}`);

    let currentPage = 0;
    let totalPages = 0;

    const listPageResult = await withErrorIsolation(
      log,
      `Failed to extract data on ${request.url}`,
      async () => {
        batchSize = config.resolveBatchSize
          ? config.resolveBatchSize(listResponse)
          : 1;

        const pagination = config.parsePagination(listResponse);
        currentPage = pagination.currentPage;
        totalPages = pagination.totalPages;

        log.info(
          `page ${currentPage} / ${totalPages}, total: ${pagination.totalEntries}`,
        );

        const rawItems = config.extractItems(listResponse);
        const existingMeta = await resolveExistingMemoized();

        const items = rawItems.map(item => {
          const existingItem = existingMeta.get(item.id);
          const needToCreate = !existingItem;
          const withDetailCrawlFields = {
            title: '',
            url: '',
            ...item,
            existingItem,
            needToCreate,
          } as TRawItem & RequireDetailCrawl<TExistingMeta>;
          return config.transformItem
            ? config.transformItem(withDetailCrawlFields)
            : withDetailCrawlFields;
        });

        const requestsToEnqueue = items
          .filter(item => item.needToCreate)
          .map(item => ({
            url: item.url,
            label: 'DETAIL',
            userData: { ...item, [LIST_PAGE_URL_USERDATA_KEY]: request.url },
          }));

        if (requestsToEnqueue.length > 0) {
          pendingListPageCompletions.set(request.url, {
            page: currentPage,
            totalPages,
            remaining: requestsToEnqueue.length,
          });
          const queue = await RequestQueue.open();
          await queue.addRequests(requestsToEnqueue);
          totalDetailPages += requestsToEnqueue.length;
          log.info(`Enqueued ${requestsToEnqueue.length} detail pages`);
        }

        // 連續 N 頁都沒有新項目就放棄這個 job source,換下一個——但在尚未走過
        // `knownPageFloors` 記錄的已知深度之前不套用這個判斷,避免 fresh 模式
        // 重新驗證「上次已經抓過、這次自然沒有新職缺」的前段分頁時被誤判為
        // 已經抓到底,連帶跳過上次尚未真正抓過、可能仍有新職缺的更深分頁。
        const knownFloor = config.knownPageFloors?.get(sourceKey) ?? 0;
        if (requestsToEnqueue.length === 0 && currentPage > knownFloor) {
          const emptyStreak =
            (consecutiveEmptyPagesBySource.get(sourceKey) ?? 0) + 1;
          consecutiveEmptyPagesBySource.set(sourceKey, emptyStreak);
          log.info(
            `${sourceProgress}: no new jobs on page ${currentPage} ` +
              `(${emptyStreak}/${maxConsecutiveEmptyListPages} consecutive empty pages)`,
          );
          if (emptyStreak >= maxConsecutiveEmptyListPages) {
            skippedSources.add(sourceKey);
            log.warning(
              `${sourceProgress}: reached ${maxConsecutiveEmptyListPages} ` +
                `consecutive pages with no new jobs, skipping remaining pages ` +
                `for this job source.`,
            );
          }
        } else if (requestsToEnqueue.length === 0) {
          log.info(
            `${sourceProgress}: no new jobs on page ${currentPage}, but still ` +
              `within previously-known depth (<= ${knownFloor}) — continuing ` +
              `without counting toward the empty-page skip.`,
          );
        } else {
          consecutiveEmptyPagesBySource.set(sourceKey, 0);
        }

        // 必須排在上方 detail 佇列之後:RequestQueue 依插入順序(FIFO)派工,
        // 先把本頁的 DETAIL 請求排入,才能確保它們在「下一頁清單」之前被處理
        // (對應原 `handler.ts` detail `priority: 1` 高於下一頁 `priority: 0` 的意圖)。
        if (currentPage < totalPages && !skippedSources.has(sourceKey)) {
          await enqueueLinks({
            urls: generateNextUrlToEnqueue(request.url),
            transformRequestFunction: req => ({
              ...req,
              priority: 0,
            }),
          });
        }

        // 只有這頁沒有新項目(沒有 DETAIL 請求要等)時才立刻標記完成;否則交由
        // DETAIL handler 在所有本頁 DETAIL 請求都處理完後透過
        // `maybeCompleteListPage` 標記,詳見上方宣告處的說明。
        if (requestsToEnqueue.length === 0) {
          await config.onListPageResolved({
            url: request.url,
            page: currentPage,
            totalPages,
            status: 'completed',
          });
        }

        lastKnownListPage = currentPage;
        lastKnownTotalListPages = totalPages;
        const pageElapsed = Date.now() - pageStart;
        listPageTracker.recordSample(pageElapsed);
        log.info(
          `List page ${currentPage}/${totalPages} took ${formatDuration(pageElapsed)}. Est. finish: ${estimateFinishTime()}`,
        );
        return LIST_PAGE_SUCCESS;
      },
    );

    if (listPageResult !== LIST_PAGE_SUCCESS) {
      // 清單頁本身處理失敗:清掉可能已註冊的待完成紀錄,避免之後 DETAIL 請求
      // 陸續處理完時又透過 `maybeCompleteListPage` 重複回報一次 completed,
      // 與這裡的 failed 狀態互相打架。
      pendingListPageCompletions.delete(request.url);
      await config.onListPageResolved({
        url: request.url,
        page: currentPage,
        totalPages,
        status: 'failed',
      });
    }
  });

  puppeteerRouter.addHandler(
    'DETAIL',
    async ({ request, page, response, crawler }) => {
      // 被限流(HTTP 429):停掉整個爬蟲,且刻意不遞減所屬清單頁的待完成計數
      // ——讓那一頁維持未完成狀態,連同這筆漏掉的職缺一起留給下次續爬。
      if (response?.status() === 429) {
        log.error(
          `Rate limited (HTTP 429) while loading detail page ${request.loadedUrl || request.url}. ` +
            `Stopping the crawl run to back off — this job stays resumable on the next run.`,
        );
        crawler.stop(`Rate limited (HTTP 429) on ${request.url}`);
        return;
      }

      // 被 Cloudflare 擋下:同樣停掉整個爬蟲、不遞減所屬清單頁的待完成計數,
      // 讓那一頁與這筆漏掉的職缺一起留給下次續爬。
      if (response && isCloudflareBlockResponse(response)) {
        log.error(
          `Blocked by Cloudflare (HTTP ${response.status()}) while loading detail page ` +
            `${request.loadedUrl || request.url}. Stopping the crawl run to back off — ` +
            `this job stays resumable on the next run.`,
        );
        crawler.stop(`Blocked by Cloudflare on ${request.url}`);
        return;
      }

      log.info(`Processing detail page: ${request.loadedUrl || request.url}`);
      const detailStart = Date.now();

      await withErrorIsolation(
        log,
        `Failed to extract data on ${request.url}`,
        async () => {
          await page
            .waitForSelector(config.detailPageWaitSelector, {
              timeout: DEFAULT_DETAIL_WAIT_SELECTOR_TIMEOUT_MS,
            })
            .catch(() => undefined);

          const detail = await page.evaluate(config.extractDetailOnHTML);

          const item = request.userData as TRawItem &
            RequireDetailCrawl<TExistingMeta>;
          const persistItem = config.buildPersistItem(item, detail);

          if (persistItem !== undefined) {
            await batchAccumulator.push(persistItem);
          }

          const detailElapsed = Date.now() - detailStart;
          detailPageTracker.recordSample(detailElapsed);
          processedDetailPages++;
          log.info(
            `Detail ${processedDetailPages}/${Math.max(totalDetailPages, processedDetailPages)} took ${formatDuration(detailElapsed)}. Est. finish: ${estimateFinishTime()}`,
          );
        },
      );

      // 無論這個 DETAIL 請求成功或失敗(`withErrorIsolation` 已吸收例外),都要
      // 算作「這個清單頁的其中一個 DETAIL 請求已處理完畢」,讓所屬清單頁能在
      // 全部 DETAIL 請求跑完後,透過 `maybeCompleteListPage` 標記為 completed。
      const listPageUrl = (
        request.userData as { [LIST_PAGE_URL_USERDATA_KEY]?: string }
      )[LIST_PAGE_URL_USERDATA_KEY];
      if (listPageUrl) {
        const pending = pendingListPageCompletions.get(listPageUrl);
        if (pending) {
          pending.remaining -= 1;
          await maybeCompleteListPage(listPageUrl);
        }
      }
    },
  );

  // `router/types.ts` declares `CrawlRouterResult.router` using crawlee's
  // `RouterHandler` default generic (`CrawlingContext`), matching the
  // approved public contract. `createPuppeteerRouter()` returns the more
  // specific `RouterHandler<PuppeteerCrawlingContext>`, which is what every
  // caller actually receives at runtime (a `PuppeteerCrawler`-compatible
  // request handler) — the widen-back-down here is a type-contract
  // reconciliation, not a runtime behavior change.
  const router = puppeteerRouter as unknown as CrawlRouterResult['router'];

  return { router, flushPending };
}
