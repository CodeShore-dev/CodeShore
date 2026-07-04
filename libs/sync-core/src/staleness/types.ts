/**
 * 週期性回訪與欄位差異偵測引擎的設定物件,涵蓋所有注入式 callback。
 * 引擎本身不得預設任何資料網域專屬欄位命名或業務邏輯,所有判斷皆透過此設定物件由呼叫端提供。
 * 對應 Requirement 3。
 */
export interface StalenessSyncConfig<TEntity extends { id: string }, TDetail> {
  /** 依呼叫端自訂條件(如多久未更新)取得需要回訪的既有項目。 */
  fetchStaleEntities: () => Promise<TEntity[]>;
  /** 從既有項目推導要回訪的詳情頁 URL。 */
  resolveDetailUrl: (entity: TEntity) => string;
  /** 依 URL 判斷所屬來源(取代寫死的 host 判斷)。 */
  resolveHost: (url: string) => string;
  /** 依來源決定等待的選擇器。 */
  waitSelectorForHost: (host: string) => string;
  /** 依來源決定擷取函式;擷取不到有效內容時回傳 undefined。 */
  extractDetailForHost: (
    host: string,
  ) => () => (TDetail | undefined) | Promise<TDetail | undefined>;
  /**
   * 比對既有項目與擷取結果,決定維持不變、更新、或標記下架/停用。
   * 三種結果皆須回傳 `entity`——`unchanged` 時由呼叫端自行組出「僅時間戳記已更新、
   * 其餘欄位不變」的物件(呼叫端知道 `TEntity` 的真實形狀,引擎不假設任何欄位存在)。
   */
  diffAndBuildUpdate: (
    entity: TEntity,
    detail: TDetail | undefined,
  ) =>
    | { action: 'unchanged'; entity: TEntity }
    | { action: 'update'; entity: TEntity }
    | { action: 'close'; entity: TEntity };
  /** 批次持久化門檻,預設 1。 */
  batchSize?: number;
  /** 待寫入項目數量達到批次門檻時觸發的批次持久化 callback。 */
  onBatchReady: (entities: TEntity[]) => Promise<void>;
  /** 可選的 logger,用於回報處理進度;未提供時使用預設的 console logger。 */
  logger?: {
    info: (msg: string) => void;
    warning: (msg: string) => void;
    error: (msg: string) => void;
  };
}
