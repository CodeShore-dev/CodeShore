import { createRouter } from '../handler';
import {
  JobDetailOnHTML,
  JobOnAPI,
  JobsAPIResponse,
} from './@types';
import { cookRawJob } from './formatter';
import {
  extractJobDetailOnHTML,
  waitFordDetailPageSelector,
} from './utils';

export const createHandler = (allGroupKeywords: string[]) =>
  createRouter<any, JobOnAPI, JobsAPIResponse, JobDetailOnHTML>({
    waitFordDetailPageSelector,
    checkJobsAPI: (url: string) =>
      url.includes('/api/client/v1/jobs/search'),
    transformPagination: (response: JobsAPIResponse) => ({
      currentPage: response.current_page,
      totalPages: response.total_pages,
      totalEntries: response.total_entries,
    }),
    getJobsFromResponse: (response: JobsAPIResponse) =>
      response.data.map(x => ({
        ...x,
        id: x.path,
      })),
    getUpdatedAtField: job => job.content_updated_at,
    extractJobDetailOnHTML,
    cookRawJob: (job, detail) =>
      cookRawJob(job, detail, allGroupKeywords),
    allGroupKeywords,
    setUpsertBatchSize: response => response.per_page,
    transformJob: job => ({
      ...job,
      url: `https://www.cake.me/companies/${job.page.path}/jobs/${job.path}`,
      title: job.title,
    }),
  });
