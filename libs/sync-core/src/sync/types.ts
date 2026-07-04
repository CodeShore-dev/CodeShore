/**
 * 通用資料存取抽象介面,供 `createSyncRouter` 轉接進 `createCrawlRouter` 的
 * `resolveExisting`/`onBatchReady`(對應需求 2.1、2.2)。不假設任何特定資料
 * 網域的欄位命名或資料表結構(對應需求 2.3、4.1)。
 */
export interface SyncRepository<TEntity, TExistingMeta> {
  /** 查詢既有項目,回傳以 id 為鍵的 Map,供判斷新增/既有。 */
  fetchExisting(): Promise<Map<string, TExistingMeta>>;
  /** 批次寫入已準備好的項目。 */
  upsertEntities(entities: TEntity[]): Promise<void>;
}
