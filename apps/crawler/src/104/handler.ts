import { getIdFromUrl } from '@codeshore/crawler-core';
import { createSyncRouter } from '@codeshore/sync-core';

import { ExistingJob } from '../@types';
import { PersistItem, sourceRegistry, syncRepository } from '../persistence';
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

export const createHandler = (
  allGroupKeywords: string[],
  totalSourceCount?: number,
  knownPageFloors?: Map<string, number>,
) =>
  createSyncRouter<
    JobsAPIResponse,
    JobOnAPI & { id: string },
    JobDetailOnHTML,
    PersistItem,
    ExistingJob
  >({
    totalSourceCount,
    knownPageFloors,
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
    detailPageWaitSelector: waitFordDetailPageSelector,
    extractDetailOnHTML: extractJobDetailOnHTML,
    buildPersistItem: buildPersistItem(allGroupKeywords),
    resolveBatchSize: response =>
      response.metadata.pagination.count,
    repository: syncRepository,
    sourceRegistry,
  });
