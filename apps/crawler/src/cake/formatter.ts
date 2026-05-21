import {
  parseKeywordsOut,
  parseSalary,
} from '@codeshore/shared-utils';
import {
  Entry,
} from '@codeshore/data-types';

import { RequireToCrawlJob } from '../@types';
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
        : job.existingJob?.created_at,
      updated_at:
        job.needToCreate || job.needToUpdate
          ? now
          : job.existingJob?.updated_at,
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
