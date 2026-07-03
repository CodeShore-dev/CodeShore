import { createCrawlRouter } from '@codeshore/crawler-core';

import { ExistingJob } from '../@types';
import {
  PersistItem,
  onBatchReady,
  onListPageResolved,
  resolveExisting,
} from '../persistence';
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
      url.includes('/api/client/v1/jobs/search'),
    parsePagination: (response: JobsAPIResponse) => ({
      currentPage: response.current_page,
      totalPages: response.total_pages,
      totalEntries: response.total_entries,
    }),
    extractItems: (response: JobsAPIResponse) =>
      response.data.map(x => ({
        ...x,
        id: x.path,
      })),
    transformItem: job => ({
      ...job,
      url: `https://www.cake.me/companies/${job.page.path}/jobs/${job.path}`,
      title: job.title,
    }),
    resolveExisting,
    detailPageWaitSelector: waitFordDetailPageSelector,
    extractDetailOnHTML: extractJobDetailOnHTML,
    buildPersistItem: buildPersistItem(allGroupKeywords),
    resolveBatchSize: response => response.per_page,
    onBatchReady,
    onListPageResolved,
  });
