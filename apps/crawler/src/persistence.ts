import { Entry, SupabaseTable } from '@codeshore/data-types';
import {
  CompanyService,
  JobKeywordService,
  JobService,
  JobSourceService,
  JobSourceURLService,
  createJobSourceURLs,
  upsertJobSourceURL,
} from '@codeshore/data-utils';
import type {
  SourceLocation,
  SourceRegistry,
  SyncRepository,
} from '@codeshore/sync-core';

/**
 * `apps/crawler` 端符合 `@codeshore/sync-core` 抽象介面合約的持久化邏輯,以既有
 * Supabase 服務(`CompanyService`/`JobService`/`JobKeywordService`/
 * `JobSourceService`/`JobSourceURLService`/`job_source_url` 相關函式)為後盾。
 *
 * 對外匯出兩個物件:
 * - `syncRepository`:實作 `SyncRepository<PersistItem, ExistingJobMeta>`,供
 *   `createSyncRouter` 轉接進 `createCrawlRouter` 的 `resolveExisting`/
 *   `onBatchReady`。104 與 Cake 兩個 router 實例皆注入同一個 `syncRepository`
 *   參照,以重現原 `apps/crawler/src/handler.ts` 模組層級全域 `existingJobs`
 *   跨 router 共享的行為(design.md「resolveExisting 記憶化」段落、
 *   「Open Questions / Risks」的跨 router 共享風險)。
 * - `sourceRegistry`:實作 `SourceRegistry`,供 `resolveSourcesToProcess`/
 *   `createSyncRouter` 使用,取代 `apps/crawler/src/main.ts` 手動組裝的
 *   `JobSourceURLService`/`JobSourceService` 查詢邏輯。
 */

/** 既有 Job 的最小中繼資訊,對應原 `apps/crawler/src/@types.ts` 的 `ExistingJob`。 */
export type ExistingJobMeta = Pick<
  SupabaseTable.Job,
  | 'id'
  | 'updated_at'
  | 'created_at'
  | 'title'
  | 'description'
  | 'location'
  | 'salary'
  | 'salary_manual'
  | 'closed'
>;

/**
 * 可持久化的項目形狀。104/Cake 的 `cookRawJob` 正常情況下回傳
 * `{ job, company, jobKeyword }`(見 `apps/crawler/src/104/formatter.ts`),
 * 與 `@codeshore/data-types` 既有匯出的 `Entry` 型別完全吻合,故直接重用而非
 * 另行定義。`company`/`jobKeyword` 額外放寬為可選:「description 為空、以既有
 * 資料標記為 closed」的 fallback 案例(task 4.3 吸收自原 `handler.ts` DETAIL
 * handler 的分支邏輯)只有 job 欄位需要更新,原邏輯本就只 push 進
 * `pendingJobs`、不寫入 company/jobKeyword,此處放寬型別以忠實重現該行為。
 */
export type PersistItem = Omit<Entry, 'company' | 'jobKeyword'> &
  Partial<Pick<Entry, 'company' | 'jobKeyword'>>;

// 模組層級記憶化:整個 `apps/crawler` 行程生命週期內,無論被哪個 router 實例
// 呼叫幾次,底層 Supabase 查詢最多只會執行一次。104 與 Cake 兩個 router 設定物件
// 都必須注入這裡匯出的同一個 `syncRepository` 參照,才能達成跨 router 共享
// (對應原 `handler.ts` 的 `let existingJobs: ExistingJob[] = [];` 模組層級變數)。
let existingMetaPromise: Promise<Map<string, ExistingJobMeta>> | undefined;

/**
 * `SyncRepository<PersistItem, ExistingJobMeta>` 實作,供 `createSyncRouter`
 * 轉接進 `createCrawlRouter` 的 `resolveExisting`/`onBatchReady`。
 */
export const syncRepository: SyncRepository<PersistItem, ExistingJobMeta> = {
  /**
   * 記憶化查找既有 Job 項目,轉為以 `id` 為鍵的 Map。
   * 對應原 `handler.ts` L220-226 的 `existingJobs` 查找邏輯,但改為模組層級
   * 記憶化(而非該檔案原本的「若快取為空才查」判斷),確保底層 Supabase 查詢
   * 在整個行程生命週期內最多執行一次。
   */
  fetchExisting(): Promise<Map<string, ExistingJobMeta>> {
    if (!existingMetaPromise) {
      existingMetaPromise = new JobService()
        .fetchAll({
          select:
            'id, updated_at, created_at, title, description, location, salary, salary_manual, closed',
        })
        .then(({ result }) => {
          const map = new Map<string, ExistingJobMeta>();
          for (const job of result as ExistingJobMeta[]) {
            map.set(job.id, job);
          }
          return map;
        });
    }
    return existingMetaPromise;
  },

  /**
   * 批次持久化:依 `entities` 內容分流呼叫 `CompanyService`/`JobService`/
   * `JobKeywordService` 的 `upsert`。對應原 `handler.ts` 的 `flushBatch`
   * (L113-133),但不再持有 pending 佇列本身——佇列的累積與門檻判斷已下放
   * 至 `@codeshore/crawler-core` 的 `createCrawlRouter`,此函式只負責「佇列
   * 準備好時」的實際寫入分派。`company`/`jobKeyword` 為可選(見 `PersistItem`
   * 型別註解的 closed-fallback 案例),此處於分派前個別過濾掉未提供的項目,
   * 避免將 `undefined` 送進對應 service 的 `upsert`。
   */
  async upsertEntities(entities: PersistItem[]): Promise<void> {
    if (entities.length === 0) return;

    const companies = entities
      .map(item => item.company)
      .filter((company): company is SupabaseTable.Company =>
        Boolean(company),
      );
    const jobs = entities.map(item => item.job);
    const jobKeywords = entities
      .map(item => item.jobKeyword)
      .filter((jobKeyword): jobKeyword is SupabaseTable.Job_.Keyword =>
        Boolean(jobKeyword),
      );

    if (companies.length > 0) {
      await new CompanyService().upsert(companies);
    }
    await new JobService().upsert(jobs);
    if (jobKeywords.length > 0) {
      await new JobKeywordService().upsert(jobKeywords);
    }
  },
};

/**
 * `SourceRegistry` 實作,包裝既有 `JobSourceService`/`JobSourceURLService`/
 * `createJobSourceURLs`/`upsertJobSourceURL`,供 `resolveSourcesToProcess`/
 * `createSyncRouter` 使用。
 */
export const sourceRegistry: SourceRegistry = {
  /**
   * 取得目前登記為 pending 狀態的來源分頁,依 url 再依 pageIndex 排序。
   * 對應原 `main.ts` L400-407 的 `JobSourceURLService().fetchAll(...)` 查詢。
   */
  async fetchPendingSources(): Promise<SourceLocation[]> {
    const { result } = await new JobSourceURLService().fetchAll({
      where: { status: { eq: 'pending' } },
      orders: [
        { column: 'url', ascending: true },
        { column: 'page_index', ascending: true },
      ],
    });
    return result.map(row => ({
      url: row.url,
      pageIndex: row.page_index,
    }));
  },

  /**
   * fresh 模式起始點:取得所有「已啟用」來源的基底 URL(不含分頁游標)。
   * 對應原 `main.ts` L433-434 的 `JobSourceService().fetchAll()` 查詢,
   * 新增 `enabled = true` 過濾,停用的來源不會被 crawl mode 抓取。
   */
  async fetchBaseSources(): Promise<string[]> {
    const { result } = await new JobSourceService().fetchAll({
      where: { enabled: { eq: true } },
    });
    return result.map(row => row.url);
  },

  /**
   * fresh 模式:在真正開始爬取前,先把第 1 頁登記為 pending。第 1 頁原本只有
   * 在自己完成或失敗後才會寫進 `job_source_url`(見 `markSourceStatus`),若
   * 爬蟲在那之前中斷,resume 模式的 `fetchPendingSources` 會完全查不到這個
   * 來源。這裡用 `createJobSourceURLs(url, 1, 1)` 只登記 page_index=1 這一列
   * 為 pending,填補這個缺口。
   */
  seedPendingPage1(url: string): Promise<void> {
    return createJobSourceURLs(url, 1, 1).then(() => undefined);
  },

  /**
   * 某來源第一頁完成後,若總頁數大於一,登記其餘分頁為待處理。
   * 對應原 `handler.ts`/`persistence.ts` 的 `onListPageResolved` 呼叫
   * `createJobSourceURLs` 的分支。
   */
  registerPendingPages(url: string, totalPages: number): Promise<void> {
    return createJobSourceURLs(url, totalPages).then(() => undefined);
  },

  /**
   * 更新某來源某分頁的最終狀態。對應原 `handler.ts`/`persistence.ts` 的
   * `onListPageResolved` 呼叫 `upsertJobSourceURL` 的部分。
   */
  markSourceStatus(
    url: string,
    pageIndex: number,
    status: 'completed' | 'failed',
  ): Promise<void> {
    return upsertJobSourceURL(url, pageIndex, status).then(() => undefined);
  },

  /**
   * fresh 模式:清除所有已追蹤的分頁狀態。對應原 `main.ts` L378-382 的
   * `JobSourceURLService().clearAll()` 呼叫。
   */
  clearAll(): Promise<void> {
    return new JobSourceURLService().clearAll().then(() => undefined);
  },

  /**
   * fresh 模式重建前,先取得每個來源目前已追蹤到的最大分頁編號(不論狀態),
   * 供 `resolveSourcesToProcess` 用於「連續 N 頁無新職缺就放棄」判斷的下限。
   */
  async fetchMaxKnownPageIndex(): Promise<Map<string, number>> {
    const { result } = await new JobSourceURLService().fetchAll({
      select: 'url, page_index',
    });
    const floors = new Map<string, number>();
    for (const row of result as { url: string; page_index: number }[]) {
      const current = floors.get(row.url) ?? 0;
      if (row.page_index > current) floors.set(row.url, row.page_index);
    }
    return floors;
  },
};
