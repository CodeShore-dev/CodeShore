import { PuppeteerCrawler } from 'crawlee';
import type { Page } from 'puppeteer';

import type { PreNavigationHook, StealthLaunchContext } from '@codeshore/crawler-core';
import {
  createBatchAccumulator,
  createRollingAverageTracker,
  formatDuration,
  withErrorIsolation,
} from '@codeshore/crawler-core';

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
 * 核心回訪迴圈(host 判斷 → 等待 → 擷取 → `diffAndBuildUpdate`)與錯誤隔離
 * 為任務 4.2 的實作切片;任務 4.3 在此基礎上接上真正的批次持久化
 * (`createBatchAccumulator({resolveBatchSize: () => config.batchSize ?? 1,
 * onFlush: config.onBatchReady})`,對應需求 3.6)——每筆處理結果透過
 * `batchAccumulator.push(entity)` 累積,達門檻時自動觸發一次
 * `config.onBatchReady`,`run()` 結束時呼叫 `flushRemaining()` 送出殘留項目
 * (比照 `crawl-router.ts` 的 `flushPending` 收尾模式)——以及單一階段的
 * 進度/ETA 追蹤(`createRollingAverageTracker()`,對應需求 3.7:`avg × 剩餘
 * 筆數` 即為 ETA,不套用 `crawl-router.ts` 清單頁+詳情頁的雙階段合成公式,
 * 因為此引擎只有「逐一回訪既有項目」這一個階段)。比照原 `reCrawlJobs`
 * (`apps/crawler/src/main.ts` L262-271)的行為:每筆項目處理完(無論成功或
 * 被 `withErrorIsolation` 攔截失敗)都無條件記錄一次耗時樣本並輸出進度。
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
      const totalCount = staleEntities.length;

      const batchAccumulator = createBatchAccumulator<TEntity>({
        resolveBatchSize: () => config.batchSize ?? 1,
        onFlush: config.onBatchReady,
      });

      const progressTracker = createRollingAverageTracker();
      let processedCount = 0;

      const crawler = new PuppeteerCrawler({
        launchContext: stealthConfig as never,
        preNavigationHooks: [preNavigationHook as never],
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 60,
        async requestHandler({ request, page, log: crawleeLog }) {
          const entity = (request.userData as { entity: TEntity }).entity;
          const handlerLog = crawleeLog ?? log;
          const entityStart = Date.now();

          const result = await withErrorIsolation(
            log,
            `Failed to revisit entity ${entity.id} (${request.url})`,
            async () => processStaleEntity(page, entity, request.url, config),
          );

          if (result !== undefined) {
            if (result.action === 'close') {
              handlerLog.warning(`[${entity.id}] marked as closed (${request.url})`);
            } else if (result.action === 'update') {
              handlerLog.info(`[${entity.id}] updated`);
            }

            await batchAccumulator.push(result.entity);
          }

          // 無條件記錄耗時樣本,無論本次處理成功或被 withErrorIsolation
          // 攔截失敗——比照原 reCrawlJobs 的 processedCount++/rollingAvgMs
          // 更新時機(位於 try/catch 區塊之外)。
          const elapsed = Date.now() - entityStart;
          processedCount++;
          progressTracker.recordSample(elapsed);
          const avgMs = progressTracker.getAverage();
          const etaMs = avgMs * (totalCount - processedCount);
          handlerLog.info(
            `[update] ${processedCount} / ${totalCount} | avg: ${formatDuration(Math.round(avgMs))} | eta: ${formatDuration(Math.round(etaMs))}`,
          );
        },
      });

      await crawler.run(
        staleEntities.map(entity => ({
          url: config.resolveDetailUrl(entity),
          userData: { entity },
        })),
      );

      await batchAccumulator.flushRemaining();
    },
  };
}
