import { Entry, SupabaseTable } from '@codeshore/data-types';
import {
  CompanyService,
  JobService,
  JobKeywordService,
  createJobSourceURLs,
  upsertJobSourceURL,
} from '@codeshore/data-utils';
import type { ListPageResolvedEvent } from '@codeshore/crawler-core';

/**
 * `apps/crawler` 端符合 `@codeshore/crawler-core` 注入式 callback 合約的持久化
 * 邏輯,以既有 Supabase 服務(`CompanyService`/`JobService`/`JobKeywordService`/
 * `job_source_url` 相關函式)為後盾。104 與 Cake 兩個 router 實例皆注入這裡匯出
 * 的同一組函式參照,以重現原 `apps/crawler/src/handler.ts` 模組層級全域
 * `existingJobs` 跨 router 共享的行為(design.md「resolveExisting 記憶化」段落、
 * 「Open Questions / Risks」的跨 router 共享風險)。
 */

/** 既有 Job 的最小中繼資訊,對應原 `apps/crawler/src/@types.ts` 的 `ExistingJob`。 */
export type ExistingJobMeta = Pick<
  SupabaseTable.Job,
  'id' | 'updated_at' | 'created_at'
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
// 都必須注入這裡匯出的同一個 `resolveExisting` 函式參照,才能達成跨 router 共享
// (對應原 `handler.ts` 的 `let existingJobs: ExistingJob[] = [];` 模組層級變數)。
let existingMetaPromise: Promise<Map<string, ExistingJobMeta>> | undefined;

/**
 * 記憶化查找既有 Job 項目,轉為以 `id` 為鍵的 Map。
 * 對應原 `handler.ts` L220-226 的 `existingJobs` 查找邏輯,但改為模組層級
 * 記憶化(而非該檔案原本的「若快取為空才查」判斷),確保底層 Supabase 查詢
 * 在整個行程生命週期內最多執行一次。
 */
export function resolveExisting(): Promise<Map<string, ExistingJobMeta>> {
  if (!existingMetaPromise) {
    existingMetaPromise = new JobService()
      .fetchAll({ select: 'id, updated_at, created_at' })
      .then(({ result }) => {
        const map = new Map<string, ExistingJobMeta>();
        for (const job of result as ExistingJobMeta[]) {
          map.set(job.id, job);
        }
        return map;
      });
  }
  return existingMetaPromise;
}

/**
 * 批次持久化:依 `items` 內容分流呼叫 `CompanyService`/`JobService`/
 * `JobKeywordService` 的 `upsert`。對應原 `handler.ts` 的 `flushBatch`
 * (L113-133),但不再持有 pending 佇列本身——佇列的累積與門檻判斷已下放
 * 至 `@codeshore/crawler-core` 的 `createCrawlRouter`,此函式只負責「佇列
 * 準備好時」的實際寫入分派。`company`/`jobKeyword` 為可選(見 `PersistItem`
 * 型別註解的 closed-fallback 案例),此處於分派前個別過濾掉未提供的項目,
 * 避免將 `undefined` 送進對應 service 的 `upsert`。
 */
export async function onBatchReady(items: PersistItem[]): Promise<void> {
  if (items.length === 0) return;

  const companies = items
    .map(item => item.company)
    .filter((company): company is SupabaseTable.Company => Boolean(company));
  const jobs = items.map(item => item.job);
  const jobKeywords = items
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
}

/**
 * 清單頁狀態回報:更新既有的進度追蹤資料。對應原 `handler.ts` L277-296:
 * - 無論成功或失敗,呼叫 `upsertJobSourceURL(url, page, status)` 更新該頁狀態。
 * - 僅在成功且為第一頁、且總頁數大於一時,呼叫 `createJobSourceURLs(url, totalPages)`
 *   預先登記其餘分頁為 `pending`,供後續清單頁走訪與斷點續傳使用。
 */
export async function onListPageResolved(
  event: ListPageResolvedEvent,
): Promise<void> {
  if (event.status === 'completed' && event.page === 1 && event.totalPages > 1) {
    await createJobSourceURLs(event.url, event.totalPages);
  }
  await upsertJobSourceURL(event.url, event.page, event.status);
}
