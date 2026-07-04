import { PuppeteerCrawler } from 'crawlee';
import type { Page } from 'puppeteer';

import type { PreNavigationHook, StealthLaunchContext } from '@codeshore/crawler-core';
import { withErrorIsolation } from '@codeshore/crawler-core';

import type { StalenessSyncConfig } from './types';

const DEFAULT_WAIT_SELECTOR_TIMEOUT_MS = 10000;

const defaultLogger = {
  info: (msg: string) => console.log(msg),
  warning: (msg: string) => console.warn(msg),
  error: (msg: string) => console.error(msg),
};

/**
 * 單一既有項目的回訪處理:依 `resolveHost` 判斷來源、取得該來源的等待選擇器
 * 與擷取函式,於詳情頁等待(逾時容忍,對應 `crawl-router.ts`/原 `reCrawlJobs`
 * 一致的 `.catch(() => undefined)` 寬容等待模式)後擷取內容,最後交給
 * `diffAndBuildUpdate` 決定 `unchanged`/`update`/`close` 三種結果之一
 * (對應需求 3.2、3.3、3.5)。
 *
 * 此函式本身不做錯誤隔離——呼叫端(`run` 的 `requestHandler`)負責以
 * `withErrorIsolation` 包裹整個呼叫,確保單一項目拋出的例外不會中斷後續
 * 項目的處理(對應需求 3.8),同時讓這個純函式本身容易單獨驗證。
 */
async function processStaleEntity<TEntity extends { id: string }, TDetail>(
  page: Pick<Page, 'waitForSelector' | 'evaluate'>,
  entity: TEntity,
  detailUrl: string,
  config: StalenessSyncConfig<TEntity, TDetail>,
): Promise<
  | { action: 'unchanged'; entity: TEntity }
  | { action: 'update'; entity: TEntity }
  | { action: 'close'; entity: TEntity }
> {
  const host = config.resolveHost(detailUrl);
  const waitSelector = config.waitSelectorForHost(host);
  const extractDetail = config.extractDetailForHost(host);

  await page
    .waitForSelector(waitSelector, { timeout: DEFAULT_WAIT_SELECTOR_TIMEOUT_MS })
    .catch(() => undefined);

  const detail = await page.evaluate(extractDetail);

  return config.diffAndBuildUpdate(entity, detail);
}

/**
 * 建立週期性回訪與欄位差異偵測引擎(對應需求 3.1-3.8)。
 *
 * `run` 依 `config.fetchStaleEntities()` 取得需回訪的既有項目,建立一個
 * `PuppeteerCrawler`(套用呼叫端提供的 `stealthConfig`/`preNavigationHook`,
 * 對應需求 5.2 沿用 `crawler-core` 的防偵測瀏覽器啟動設定),逐一造訪每個
 * 項目的詳情頁 URL。
 *
 * **此為任務 4.2 的實作切片**:核心回訪迴圈(host 判斷 → 等待 → 擷取 →
 * `diffAndBuildUpdate`)與錯誤隔離已完整實作;批次累積門檻
 * (`createBatchAccumulator`)與滾動平均/ETA 進度追蹤
 * (`createRollingAverageTracker`)尚未整合——目前每個項目的處理結果直接
 * 呼叫一次 `config.onBatchReady([entity])`,由任務 4.3 接手改為真正的批次
 * 累積與進度回報(詳見本檔案 CONCERNS 說明)。
 */
export function createStalenessSyncEngine<TEntity extends { id: string }, TDetail>(
  config: StalenessSyncConfig<TEntity, TDetail>,
): {
  run: (
    stealthConfig: StealthLaunchContext,
    preNavigationHook: PreNavigationHook,
  ) => Promise<void>;
} {
  const log = config.logger ?? defaultLogger;

  return {
    async run(stealthConfig, preNavigationHook) {
      const staleEntities = await config.fetchStaleEntities();

      const crawler = new PuppeteerCrawler({
        launchContext: stealthConfig as never,
        preNavigationHooks: [preNavigationHook as never],
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 60,
        async requestHandler({ request, page, log: crawleeLog }) {
          const entity = (request.userData as { entity: TEntity }).entity;
          const handlerLog = crawleeLog ?? log;

          const result = await withErrorIsolation(
            log,
            `Failed to revisit entity ${entity.id} (${request.url})`,
            async () => processStaleEntity(page, entity, request.url, config),
          );

          if (result === undefined) {
            return;
          }

          if (result.action === 'close') {
            handlerLog.warning(`[${entity.id}] marked as closed (${request.url})`);
          } else if (result.action === 'update') {
            handlerLog.info(`[${entity.id}] updated`);
          }

          await config.onBatchReady([result.entity]);
        },
      });

      await crawler.run(
        staleEntities.map(entity => ({
          url: config.resolveDetailUrl(entity),
          userData: { entity },
        })),
      );
    },
  };
}
