import { Entry, SupabaseTable } from '@codeshore/data-types';
import { getIdFromUrl } from '@codeshore/crawler-core';
import {
  parseKeywordsOut,
  parseSalary,
} from '@codeshore/shared-utils';

import { RequireToCrawlJob } from '../@types';
import { ComparableJobFields, hasJobFieldsChanged } from '../job-diff';
import { PersistItem } from '../persistence';
import { JobDetailOnHTML, JobOnAPI } from './@types';

export function cookRawJob(
  job: JobOnAPI & RequireToCrawlJob,
  detail: JobDetailOnHTML,
  allGroupKeywords: string[] = [],
): Entry {
  const now = new Date();
  const company_id = getIdFromUrl(job.link.cust);
  const salary = detail.salary ?? '';
  const title = job.jobName;
  const location = job.jobAddrNoDesc;
  const description = detail.description;
  const existingItem = job.existingItem;

  // `salary_manual` 例外規則(design.md §6.2 記載的呼叫端責任):既有職缺被
  // 人工調整過薪資時,`salary` 這個 key 必須同時從 previous/fresh 兩側省略,
  // 避免爬蟲重新爬到的原始薪資字串把人工調整的 `updated_at` 誤判為異動。
  const salaryManual = existingItem?.salary_manual === true;
  const freshComparable: ComparableJobFields = {
    title,
    description,
    location,
    closed: false,
    ...(salaryManual ? {} : { salary }),
  };
  const previousComparable: ComparableJobFields = existingItem
    ? {
        title: existingItem.title,
        description: existingItem.description,
        location: existingItem.location,
        closed: existingItem.closed,
        ...(salaryManual ? {} : { salary: existingItem.salary }),
      }
    : {};

  // `crawled_at`:不論內容是否改變,一律更新為本次處理時間(需求 2.1、2.4)。
  // `updated_at`:新職缺兩者一起設為 now(需求 2.4);既有職缺只有在
  // `hasJobFieldsChanged` 偵測到真的有欄位變化時才前移(需求 2.2),否則維持
  // 原值不變(需求 2.3)。
  const crawled_at = now;
  const updated_at = job.needToCreate
    ? now
    : hasJobFieldsChanged(previousComparable, freshComparable)
      ? now
      : existingItem?.updated_at;

  return {
    job: {
      id: job.id,
      title,
      detail_link: job.link.job,
      created_at: job.needToCreate ? now : existingItem?.created_at,
      crawled_at,
      updated_at,
      location,
      description,
      company_id,
      salary,
      ...parseSalary(salary),
      closed: false,
    },
    company: {
      id: company_id,
      name: job.custName,
      link: job.link.cust,
      type: job.coIndustryDesc,
      created_at: now,
    },
    jobKeyword: {
      id: job.id,
      ...parseKeywordsOut(
        detail.description,
        allGroupKeywords,
      ),
    },
  };
}

/**
 * `CrawlRouterConfig['buildPersistItem']`-shaped callback for the 104 site
 * adapter. Absorbs the "description 為空則以既有資料標記為 closed,否則略過"
 * business decision that used to live in the OLD `apps/crawler/src/handler.ts`
 * DETAIL handler (`if (job.description) { ... } else if (existingJob) { ... }`),
 * per design.md's CrawlRouter 3.6 note: the engine itself no longer inspects
 * `description` — that judgment call is entirely the call site's
 * responsibility now.
 *
 * Note on the `existingItem` shape: the OLD handler's closed-fallback spread
 * a FULL `SupabaseTable.Job` row (`request.userData['existingJob'] as
 * SupabaseTable.Job | undefined`) sourced from `existingJobs` — but that
 * module-level cache was itself only ever fetched with
 * `select: 'id, updated_at, created_at'` (see the OLD `handler.ts` L220-226),
 * so at runtime `existingJob` never actually carried `title`/`company_id`/etc.
 * either; the wider `SupabaseTable.Job` typing there was already a fiction
 * papered over by an `as SupabaseTable.Job` cast. The `existingItem`
 * (`ExistingJob`, originally `Pick<SupabaseTable.Job, 'id' | 'updated_at' |
 * 'created_at'>`, populated by `apps/crawler/src/persistence.ts`'s
 * `resolveExisting`) used to carry exactly the same real-world fields the
 * old code ever had — see the note below on task 2.2's widening of that
 * type/select. Spreading it into a `closed: true`
 * update and casting to `SupabaseTable.Job` (mirroring the OLD code's own
 * cast) reproduces the exact same runtime write: `JobService().upsert(...)`
 * goes through Supabase's default `upsert` (merge-duplicates) semantics
 * (`onConflict: 'id'`, no `ignoreDuplicates`), which only touches the columns
 * present in the payload — so a `{id, updated_at, created_at, closed: true}`
 * payload updates exactly `updated_at`/`closed` (and now `crawled_at`, per
 * task 3.1's `crawled_at`/`updated_at` split, design.md §6.3) on the
 * existing row and leaves every other column untouched, identical to what
 * the OLD code's "full row" write actually persisted.
 *
 * Note: `persistence.ts`'s `ExistingJobMeta`/`resolveExisting` select
 * (and this module's `ExistingJob`) WAS widened as of task 2.2 — it now
 * also carries `title`/`description`/`location`/`salary`/`salary_manual`/
 * `closed`, which `cookRawJob` needs to call `hasJobFieldsChanged`. This
 * closed-fallback branch does not need those extra fields for its own
 * write payload (it still only overrides `crawled_at`/`updated_at`/
 * `closed` below), but it does rely on `existingItem.closed` — now
 * available thanks to that same widening — to decide whether this is a
 * genuinely new closed-transition.
 */
export const buildPersistItem =
  (allGroupKeywords: string[] = []) =>
  (
    job: JobOnAPI & RequireToCrawlJob,
    detail: JobDetailOnHTML,
  ): PersistItem | undefined => {
    if (detail.description) {
      return cookRawJob(job, detail, allGroupKeywords);
    }

    if (!job.existingItem) {
      return undefined;
    }

    const now = new Date();
    return {
      job: {
        ...job.existingItem,
        crawled_at: now,
        // 只有「本來未關閉」才是真正的異動(需求 2.2);已經是 closed 的職缺
        // 這次仍抓不到描述,不算新異動,`updated_at` 維持原值(需求 2.3)。
        updated_at:
          job.existingItem.closed !== true ? now : job.existingItem.updated_at,
        closed: true,
      } as SupabaseTable.Job,
    };
  };
