export interface SourceLocation {
  url: string;
  pageIndex: number;
}

export interface SourceRegistry {
  /** 取得目前登記為 pending 狀態的來源分頁,依 url 再依 pageIndex 排序。 */
  fetchPendingSources(): Promise<SourceLocation[]>;
  /** fresh 模式起始點:取得所有來源的基底 URL(不含分頁游標)。 */
  fetchBaseSources(): Promise<string[]>;
  /** 某來源第一頁完成後,若總頁數大於一,登記其餘分頁為 pending。 */
  registerPendingPages(url: string, totalPages: number): Promise<void>;
  /** 更新某來源某分頁的最終狀態。 */
  markSourceStatus(
    url: string,
    pageIndex: number,
    status: 'completed' | 'failed',
  ): Promise<void>;
  /** fresh 模式:清除所有已追蹤的分頁狀態。 */
  clearAll(): Promise<void>;
}

export type SourceProcessingMode = 'fresh' | 'resume';
