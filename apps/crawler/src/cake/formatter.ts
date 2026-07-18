import { Entry, SupabaseTable } from '@codeshore/data-types';
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
  const salary = detail.salary;
  const title = job.title;
  const location = job.page.geo.region_l;
  const description =
    detail.description + `\nTags: ${job.tags.join(', ')}`;
  const company_id = job.page.path;
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
      detail_link: job.url,
      location,
      description,
      company_id,
      salary,
      ...parseSalary(salary),
      created_at: job.needToCreate ? now : existingItem?.created_at,
      crawled_at,
      updated_at,
      closed: false,
    },
    company: {
      id: company_id,
      name: job.page.name,
      link: `https://www.cake.me/companies/${company_id}`,
      type: detail.company_type,
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
 * `CrawlRouterConfig['buildPersistItem']`-shaped callback for the Cake site
 * adapter. Mirrors `apps/crawler/src/104/formatter.ts`'s `buildPersistItem`:
 * absorbs the "description 為空則以既有資料標記為 closed,否則略過" business
 * decision that used to live in the OLD `apps/crawler/src/handler.ts` DETAIL
 * handler (`if (job.description) { ... } else if (existingJob) { ... }`),
 * shared generically between 104 and Cake in the old engine, per design.md's
 * CrawlRouter 3.6 note: the engine itself no longer inspects `description` —
 * that judgment call is entirely the call site's responsibility now.
 *
 * See `104/formatter.ts`'s `buildPersistItem` doc comment for the full
 * rationale on why spreading `existingItem` (`ExistingJob`, populated by
 * `persistence.ts`'s `resolveExisting`) into a `closed: true` update
 * reproduces the exact same runtime write the OLD code performed, despite
 * carrying fewer fields than a full `SupabaseTable.Job` row — Supabase's
 * default `upsert` (merge-duplicates) semantics only touch the columns
 * present in the payload. `persistence.ts`'s `ExistingJobMeta`/
 * `resolveExisting` select (and `../@types.ts`'s `ExistingJob`) was widened
 * as of task 2.2 to also carry `title`/`description`/`location`/`salary`/
 * `salary_manual`/`closed`, which `cookRawJob` needs to call
 * `hasJobFieldsChanged`; this closed-fallback branch does not need those
 * extra fields for its own write payload (it still only overrides
 * `crawled_at`/`updated_at`/`closed` below), but it does rely on
 * `existingItem.closed` — now available thanks to that same widening — to
 * decide whether this is a genuinely new closed-transition.
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
