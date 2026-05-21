import { createRouter } from '../handler';
import { getIdFromUrl } from '../utils';
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
      url.includes('/jobs/search/api/jobs'),
    transformPagination: (response: JobsAPIResponse) => ({
      currentPage: response.metadata.pagination.currentPage,
      totalPages: response.metadata.pagination.lastPage,
      totalEntries: response.metadata.pagination.total,
    }),
    getJobsFromResponse: (response: JobsAPIResponse) =>
      response.data.map(x => ({
        ...x,
        id: getIdFromUrl(x.link.job),
      })),
    getUpdatedAtField: job => job.appearDate,
    extractJobDetailOnHTML,
    setUpsertBatchSize: response =>
      response.metadata.pagination.count,
    cookRawJob: (job, detail) =>
      cookRawJob(job, detail, allGroupKeywords),
    allGroupKeywords,
    transformJob: job => ({
      ...job,
      url: job.link.job,
      title: job.jobName,
    }),
  });
