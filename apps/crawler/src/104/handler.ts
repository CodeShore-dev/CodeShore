import { createCrawlRouter } from '@codeshore/crawler-core';

import { ExistingJob } from '../@types';
import {
  PersistItem,
  onBatchReady,
  onListPageResolved,
  resolveExisting,
} from '../persistence';
import { getIdFromUrl } from '../utils';
import {
  JobDetailOnHTML,
  JobOnAPI,
  JobsAPIResponse,
} from './@types';
import { buildPersistItem } from './formatter';
import {
  extractJobDetailOnHTML,
  waitFordDetailPageSelector,
} from './utils';

export const createHandler = (allGroupKeywords: string[]) =>
  createCrawlRouter<
    JobsAPIResponse,
    JobOnAPI & { id: string },
    JobDetailOnHTML,
    PersistItem,
    ExistingJob
  >({
    matchListResponse: (url: string) =>
      url.includes('/jobs/search/api/jobs'),
    parsePagination: (response: JobsAPIResponse) => ({
      currentPage: response.metadata.pagination.currentPage,
      totalPages: response.metadata.pagination.lastPage,
      totalEntries: response.metadata.pagination.total,
    }),
    extractItems: (response: JobsAPIResponse) =>
      response.data.map(x => ({
        ...x,
        id: getIdFromUrl(x.link.job),
      })),
    transformItem: job => ({
      ...job,
      url: job.link.job,
      title: job.jobName,
    }),
    resolveExisting,
    detailPageWaitSelector: waitFordDetailPageSelector,
    extractDetailOnHTML: extractJobDetailOnHTML,
    buildPersistItem: buildPersistItem(allGroupKeywords),
    resolveBatchSize: response =>
      response.metadata.pagination.count,
    onBatchReady,
    onListPageResolved,
  });
