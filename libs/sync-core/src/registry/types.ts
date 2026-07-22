export interface SourceLocation {
  url: string;
  pageIndex: number;
}

export interface SourceRegistry {
  /** 取得目前登記為 pending 狀態的來源分頁,依 url 再依 pageIndex 排序。 */
  fetchPendingSources(): Promise<SourceLocation[]>;
  /** fresh 模式起始點:取得所有來源的基底 URL(不含分頁游標)。 */
  fetchBaseSources(): Promise<string[]>;
  /**
   * fresh 模式:在真正開始爬取前,先把每個來源的第 1 頁登記為 pending。
   * 第 1 頁原本要等自己完成(或失敗)後才會被寫進追蹤表,若爬蟲在那之前中斷,
   * resume 模式的 `fetchPendingSources` 就永遠查不到這個來源、永遠不會續爬。
   * 預先登記為 pending 可以避免這個缺口。
   */
  seedPendingPage1(url: string): Promise<void>;
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
  /**
   * fresh 模式:在 `clearAll` 清空追蹤表之前,先取得每個來源目前已追蹤到的
   * 最大分頁編號(不論該分頁狀態是 pending／completed／failed)。
   *
   * 用途:fresh 模式會從第 1 頁重新爬取以撿回排序前面的新職缺,但重新爬到的
   * 前幾頁如果剛好都已經抓過(沒有新職缺),不能被「連續 N 頁無新職缺」的判斷
   * 誤判為「這個來源已經抓到底了」而提前放棄——否則上一輪中斷、還沒真正抓過
   * 的更深分頁就永遠不會被重新造訪。這裡取得的數字就是拿來當作那個判斷的
   * 下限:必須先重新走過至少這個深度,才會開始判斷是否要放棄這個來源。
   */
  fetchMaxKnownPageIndex(): Promise<Map<string, number>>;
}

export type SourceProcessingMode = 'fresh' | 'resume';
