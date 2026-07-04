import { createCrawlRouter } from '@codeshore/crawler-core';
import type {
  CrawlItemBase,
  CrawlRouterConfig,
  CrawlRouterResult,
  ListPageResolvedEvent,
} from '@codeshore/crawler-core';

import type { SourceRegistry } from '../registry/types';
import type { SyncRepository } from './types';

/**
 * 把通用的 `SyncRepository` + `SourceRegistry` 轉接進 `@codeshore/crawler-core`
 * 的 `createCrawlRouter`,取代個別呼叫端各自手動組裝 `resolveExisting`/
 * `onBatchReady`/`onListPageResolved` 三個 callback 的寫法(對應需求 2.1、2.2)。
 *
 * - `resolveExisting`/`onBatchReady` 直接轉接至 `repository.fetchExisting`/
 *   `repository.upsertEntities`。
 * - `onListPageResolved` 由本函式組合出通用的分頁登記/狀態回報邏輯:當某個
 *   分頁「完成且為第一頁、且總頁數大於一」時呼叫 `sourceRegistry.
 *   registerPendingPages`,登記其餘分頁為待處理;任何完成或失敗的結果都無
 *   條件呼叫 `sourceRegistry.markSourceStatus` 記錄該分頁的最終狀態(對應需求
 *   1.3、1.4,泛化自原 `apps/crawler/src/persistence.ts` 的 `onListPageResolved`)。
 * - 其餘設定欄位(`matchListResponse`/`parsePagination`/`extractItems`/
 *   `detailPageWaitSelector`/`extractDetailOnHTML`/`buildPersistItem`/
 *   `resolveBatchSize` 等)原樣轉交給 `createCrawlRouter`,本函式不修改其行為。
 *
 * `SyncRepository`/`SourceRegistry` 介面與本函式的型別簽章皆不含任何特定業務
 * 網域詞彙,`TEntity`/`TExistingMeta` 為純泛型(對應需求 2.3)。
 */
export function createSyncRouter<
  TListResponse,
  TRawItem extends CrawlItemBase,
  TDetail,
  TEntity,
  TExistingMeta,
>(
  config: Omit<
    CrawlRouterConfig<TListResponse, TRawItem, TDetail, TEntity, TExistingMeta>,
    'resolveExisting' | 'onBatchReady' | 'onListPageResolved'
  > & {
    repository: SyncRepository<TEntity, TExistingMeta>;
    sourceRegistry: SourceRegistry;
  },
): CrawlRouterResult {
  const { repository, sourceRegistry, ...crawlRouterConfig } = config;

  const onListPageResolved = async (
    event: ListPageResolvedEvent,
  ): Promise<void> => {
    if (
      event.status === 'completed' &&
      event.page === 1 &&
      event.totalPages > 1
    ) {
      await sourceRegistry.registerPendingPages(event.url, event.totalPages);
    }
    await sourceRegistry.markSourceStatus(event.url, event.page, event.status);
  };

  return createCrawlRouter<TListResponse, TRawItem, TDetail, TEntity, TExistingMeta>({
    ...crawlRouterConfig,
    resolveExisting: () => repository.fetchExisting(),
    onBatchReady: entities => repository.upsertEntities(entities),
    onListPageResolved,
  });
}
