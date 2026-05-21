import {
  parseKeywordsOut,
  parseSalary,
} from '@codeshore/shared-utils';
import {
  Entry,
} from '@codeshore/data-types';

import { RequireToCrawlJob } from '../@types';
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
        : job.existingJob?.created_at,
      updated_at:
        job.needToCreate || job.needToUpdate
          ? now
          : job.existingJob?.updated_at,
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
