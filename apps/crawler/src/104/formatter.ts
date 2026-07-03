import { Entry, SupabaseTable } from '@codeshore/data-types';
import {
  parseKeywordsOut,
  parseSalary,
} from '@codeshore/shared-utils';

import { RequireToCrawlJob } from '../@types';
import { PersistItem } from '../persistence';
import { getIdFromUrl } from '../utils';
import { JobDetailOnHTML, JobOnAPI } from './@types';

export function cookRawJob(
  job: JobOnAPI & RequireToCrawlJob,
  detail: JobDetailOnHTML,
  allGroupKeywords: string[] = [],
): Entry {
  const now = new Date();
  const company_id = getIdFromUrl(job.link.cust);
  const salary = detail.salary ?? '';

  return {
    job: {
      id: job.id,
      title: job.jobName,
      detail_link: job.link.job,
      created_at: job.needToCreate
        ? now
        : job.existingItem?.created_at,
      updated_at: job.needToCreate
        ? now
        : job.existingItem?.updated_at,
      location: job.jobAddrNoDesc,
      description: detail.description,
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
 * papered over by an `as SupabaseTable.Job` cast. The new `existingItem`
 * (`ExistingJob`, i.e. `Pick<SupabaseTable.Job, 'id' | 'updated_at' |
 * 'created_at'>`, populated by `apps/crawler/src/persistence.ts`'s
 * `resolveExisting` with the identical `select`) carries exactly the same
 * real-world fields the old code ever had. Spreading it into a `closed: true`
 * update and casting to `SupabaseTable.Job` (mirroring the OLD code's own
 * cast) reproduces the exact same runtime write: `JobService().upsert(...)`
 * goes through Supabase's default `upsert` (merge-duplicates) semantics
 * (`onConflict: 'id'`, no `ignoreDuplicates`), which only touches the columns
 * present in the payload — so a `{id, updated_at, created_at, closed: true}`
 * payload updates exactly `updated_at`/`closed` on the existing row and
 * leaves every other column untouched, identical to what the OLD code's
 * "full row" write actually persisted. No widening of `persistence.ts`'s
 * `ExistingJobMeta`/`resolveExisting` select is necessary.
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

    return {
      job: {
        ...job.existingItem,
        updated_at: new Date(),
        closed: true,
      } as SupabaseTable.Job,
    };
  };
