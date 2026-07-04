import { RequestQueue, createPuppeteerRouter } from 'crawlee';
import type { HTTPResponse, Page } from 'puppeteer';

import { createBatchAccumulator } from '../progress/batch-accumulator';
import { withErrorIsolation } from '../progress/error-isolation';
import { createRollingAverageTracker } from '../progress/rolling-average';
import { formatDuration } from '../time';
import type {
  CrawlItemBase,
  CrawlRouterConfig,
  CrawlRouterResult,
  RequireDetailCrawl,
} from './types';

const DEFAULT_LIST_RESPONSE_TIMEOUT_MS = 30000;
const DEFAULT_MAX_LIST_RETRIES = 10;

const defaultLogger = {
  info: (msg: string) => console.log(msg),
  warning: (msg: string) => console.warn(msg),
  error: (msg: string) => console.error(msg),
};

/**
 * 攔截清單頁的 API 回應,並在逾時未攔截到符合條件的回應時,依 `maxListRetries`
 * 重新載入頁面重試。符合條件的判斷結合呼叫端注入的 `matchListResponse(url)`
 * 與引擎固定的 `method() !== 'OPTIONS'`、`status() === 200` 檢查(此兩項不對外開放客製化)。
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

    const waitForListResponse = new Promise<TListResponse>(resolve => {
      responseHandler = res => {
        const req = res.request();
        const url = res.url();
        if (
          options.matchListResponse(url) &&
          req.method() !== 'OPTIONS' &&
          res.status() === 200
        ) {
          res
            .json()
            .then(json => resolve(json as TListResponse))
            .catch(error => {
              log.error(`Failed to parse list response JSON: ${error}`);
            });
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

  puppeteerRouter.addDefaultHandler(async ({ request, page }) => {
    log.info(`Processing: ${request.url}`);
    const pageStart = Date.now();

    const listResponse = await interceptListResponse<TListResponse>(page, {
      matchListResponse: config.matchListResponse,
      listResponseTimeoutMs: config.listResponseTimeoutMs,
      maxListRetries: config.maxListRetries,
      waitForListPage: config.waitForListPage,
      logger: config.logger,
    });

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
            userData: item,
          }));

        if (requestsToEnqueue.length > 0) {
          const queue = await RequestQueue.open();
          await queue.addRequests(requestsToEnqueue);
          totalDetailPages += requestsToEnqueue.length;
          log.info(`Enqueued ${requestsToEnqueue.length} detail pages`);
        }

        await config.onListPageResolved({
          url: request.url,
          page: currentPage,
          totalPages,
          status: 'completed',
        });

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
    async ({ request, page }) => {
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
