import { createPuppeteerRouter } from 'crawlee';
import type { HTTPResponse, Page } from 'puppeteer';

import type {
  CrawlItemBase,
  CrawlRouterConfig,
  CrawlRouterResult,
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

/**
 * 建立通用清單/詳情爬蟲路由引擎。
 *
 * 此為任務 3.2 的實作切片:僅實作清單頁 API 回應攔截與可設定的逾時/重試邏輯
 * (對應需求 3.1、3.2)。分頁解析、項目擷取、詳情頁走訪、批次持久化與進度追蹤
 * (任務 3.3-3.5)尚未接上,`flushPending` 目前為 no-op 佔位。
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

  puppeteerRouter.addDefaultHandler(async ({ request, page }) => {
    log.info(`Processing: ${request.url}`);

    const listResponse = await interceptListResponse<TListResponse>(page, {
      matchListResponse: config.matchListResponse,
      listResponseTimeoutMs: config.listResponseTimeoutMs,
      maxListRetries: config.maxListRetries,
      waitForListPage: config.waitForListPage,
      logger: config.logger,
    });

    log.info(`Intercepted list response for: ${request.url}`);
    void listResponse;
  });

  // `router/types.ts` declares `CrawlRouterResult.router` using crawlee's
  // `RouterHandler` default generic (`CrawlingContext`), matching the
  // approved public contract. `createPuppeteerRouter()` returns the more
  // specific `RouterHandler<PuppeteerCrawlingContext>`, which is what every
  // caller actually receives at runtime (a `PuppeteerCrawler`-compatible
  // request handler) — the widen-back-down here is a type-contract
  // reconciliation, not a runtime behavior change.
  const router = puppeteerRouter as unknown as CrawlRouterResult['router'];

  const flushPending = async () => {
    /* 尚無待清空的批次佇列;批次持久化將於任務 3.6/3.7 接上。 */
  };

  return { router, flushPending };
}
