import { Entry, SupabaseTable } from '@codeshore/data-types';
import {
  parseKeywordsOut,
  parseSalary,
} from '@codeshore/shared-utils';

import { RequireToCrawlJob } from '../@types';
import { PersistItem } from '../persistence';
import { JobDetailOnHTML, JobOnAPI } from './@types';

export function cookRawJob(
  job: JobOnAPI & RequireToCrawlJob,
  detail: JobDetailOnHTML,
  allGroupKeywords: string[] = [],
): Entry {
  const now = new Date();
  const salary = detail.salary;
  const description =
    detail.description + `\nTags: ${job.tags.join(', ')}`;
  const company_id = job.page.path;

  return {
    job: {
      id: job.id,
      title: job.title,
      detail_link: job.url,
      location: job.page.geo.region_l,
      description,
      company_id,
      salary,
      ...parseSalary(salary),
      created_at: job.needToCreate
        ? now
        : job.existingItem?.created_at,
      updated_at: job.needToCreate
        ? now
        : job.existingItem?.updated_at,
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
 * `persistence.ts`'s `resolveExisting` with `select: 'id, updated_at,
 * created_at'`) into a `closed: true` update reproduces the exact same
 * runtime write the OLD code performed, despite carrying fewer fields than a
 * full `SupabaseTable.Job` row — Supabase's default `upsert` (merge-
 * duplicates) semantics only touch the columns present in the payload.
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
