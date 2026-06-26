import {
  RequestQueue,
  createPuppeteerRouter,
} from 'crawlee';
import { Page } from 'puppeteer';

import { SupabaseTable } from '@codeshore/data-types';
import {
  CompanyService,
  JobService,
  createJobSourceURLs,
  upsertJobSourceURL,
  JobKeywordService,
} from '@codeshore/data-utils';

import { ExistingJob, RequireToCrawlJob } from './@types';
import {
  formatDuration,
  generateNextUrlToEnqueue,
  getIdFromUrl,
} from './utils';

let existingJobs: ExistingJob[] = [];

export const createRouter = <
  JobOnHTML extends { id: string },
  JobOnAPI,
  JobsAPIResponse,
  JobDetailOnHTML,
>({
  checkJobsAPI,
  transformPagination,
  waitFordDetailPageSelector,
  getJobsFromResponse,
  extractJobDetailOnHTML,
  cookRawJob,
  transformJob,
  allGroupKeywords,
  waitForListPage = async () => {},
  setUpsertBatchSize = () => 1,
}: {
  waitFordDetailPageSelector: string;
  waitForListPage?: (page: Page) => Promise<void>;
  extractJobsOnHTML?: () => Promise<JobOnHTML[]>;
  checkJobsAPI: (url: string) => boolean;
  transformPagination: (response: JobsAPIResponse) => {
    currentPage: number;
    totalPages: number;
    totalEntries: number;
  };
  getJobsFromResponse: (
    response: JobsAPIResponse,
  ) => (JobOnAPI & { id: string })[];
  getUpdatedAtField: (
    job: JobOnAPI,
  ) => string | number | Date;
  extractJobDetailOnHTML: () =>
    | Promise<JobDetailOnHTML>
    | JobDetailOnHTML;
  cookRawJob: (
    job: JobOnAPI & RequireToCrawlJob,
    detail: JobDetailOnHTML,
    allGroupKeywords: string[],
  ) => {
    job: SupabaseTable.Job;
    company: SupabaseTable.Company;
    jobKeyword: SupabaseTable.Job_.Keyword;
  };
  allGroupKeywords: string[];
  transformJob: (
    job: JobOnAPI & RequireToCrawlJob,
  ) => JobOnAPI & RequireToCrawlJob;
  setUpsertBatchSize?: (
    response: JobsAPIResponse,
  ) => number;
}) => {
  let batchSize = 1;
  const pendingCompanies: SupabaseTable.Company[] = [];
  const pendingJobs: SupabaseTable.Job[] = [];
  const pendingJobKeywords: SupabaseTable.Job_.Keyword[] =
    [];

  let listPageAvgDuration = 0;
  let listPageCount = 0;
  let detailPageAvgDuration = 0;
  let detailPageCount = 0;
  let totalDetailPages = 0;
  let processedDetailPages = 0;
  let lastKnownListPage = 0;
  let lastKnownTotalListPages = 1;

  const estimateFinishTime = (): string => {
    const avgList = listPageAvgDuration;
    const avgDetail = detailPageAvgDuration;
    const remainingList =
      lastKnownTotalListPages - lastKnownListPage;
    const projectedTotalDetail =
      lastKnownListPage > 0
        ? Math.round(
            (totalDetailPages / lastKnownListPage) *
              lastKnownTotalListPages,
          )
        : totalDetailPages;
    const remainingDetail = Math.max(
      0,
      projectedTotalDetail - processedDetailPages,
    );
    const etaMs =
      remainingList * avgList + remainingDetail * avgDetail;
    return formatDuration(etaMs);
  };

  const flushBatch = async (log?: {
    info: (msg: string) => void;
  }) => {
    if (
      pendingCompanies.length === 0 &&
      pendingJobs.length === 0
    )
      return;
    const companyCount = pendingCompanies.length;
    const jobCount = pendingJobs.length;
    await new CompanyService().upsert([
      ...pendingCompanies,
    ]);
    await new JobService().upsert([...pendingJobs]);
    await new JobKeywordService().upsert([...pendingJobKeywords]);
    pendingCompanies.length = 0;
    pendingJobs.length = 0;
    log?.info(
      `Flushed batch: ${companyCount} companies, ${jobCount} jobs`,
    );
  };

  const router = createPuppeteerRouter();

  router.addDefaultHandler(
    async ({ request, page, log, enqueueLinks }) => {
      log.info(`Processing: ${request.url}`);
      const pageStart = Date.now();

      await page.exposeFunction(
        'getIdFromUrl',
        getIdFromUrl,
      );

      const MAX_RETRIES = 10;
      let apiResponse: JobsAPIResponse | undefined;

      for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
      ) {
        let responseHandler!: Parameters<
          typeof page.on<'response'>
        >[1];

        const waitForJobsResponse =
          new Promise<JobsAPIResponse>(resolve => {
            responseHandler = async res => {
              const req = res.request();
              const url = res.url();
              if (
                checkJobsAPI(url) &&
                req.method() !== 'OPTIONS' &&
                res.status() === 200
              ) {
                try {
                  resolve(await res.json());
                } catch (error) {
                  console.error(error);
                }
              }
            };
            page.on('response', responseHandler);
          });

        try {
          if (attempt > 1) {
            log.warning(
              `Retry ${attempt}/${MAX_RETRIES} for ${request.url}`,
            );
            await page.reload();
          }
          await waitForListPage(page).catch(() => {});

          apiResponse = await Promise.race([
            waitForJobsResponse,
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      'Timeout waiting for job list API',
                    ),
                  ),
                30000,
              ),
            ),
          ]);
          page.off('response', responseHandler);
          break;
        } catch (err) {
          page.off('response', responseHandler);
          if (attempt === MAX_RETRIES) throw err;
        }
      }

      const response = apiResponse!;
      const { currentPage, totalEntries, totalPages } =
        transformPagination(response);
      try {
        batchSize = setUpsertBatchSize(response);

        log.info(
          `page ${currentPage} / ${totalPages}, total: ${totalEntries}`,
        );

        if (existingJobs.length === 0) {
          ({ result: existingJobs } =
            await new JobService().fetchAll({
              select: 'id, updated_at, created_at',
            }));
            log.info(`Fetched ${existingJobs.length} jobs`)
        }

        const jobs = getJobsFromResponse(response)
          .map(x => {
            const existingJob = existingJobs.find(
              y => y.id === x.id,
            );
            const needToCreate = !existingJob;
            return {
              title: '',
              url: '',
              ...x,
              existingJob,
              needToCreate,
            };
          })
          .map(transformJob);

        log.info(
          `Scraped ${jobs.length} jobs, ${jobs.filter(x => x.needToCreate).length} to create`,
        );

        const incorrectJobs = jobs.filter(
          x => !x.title || !x.url,
        );
        if (incorrectJobs.length > 0) {
          log.warning(
            `Skipped ${incorrectJobs.length} jobs with empty title or url.`,
          );
        }

        const requestsToEnqueue = jobs
          .filter(x => x.title && x.url)
          .filter(x => x.needToCreate)
          .map(job => {
            return {
              url: job.url,
              label: 'DETAIL',
              userData: job,
              priority: 1,
            };
          });

        if (requestsToEnqueue.length > 0) {
          const queue = await RequestQueue.open();
          await queue.addRequests(requestsToEnqueue);
          totalDetailPages += requestsToEnqueue.length;
          log.info(
            `Enqueued ${requestsToEnqueue.length} detail pages`,
          );
        }
        if (currentPage === 1 && totalPages > 1) {
          await createJobSourceURLs(
            request.url,
            totalPages,
          );
        }
        if (currentPage < totalPages) {
          await enqueueLinks({
            urls: generateNextUrlToEnqueue(request.url),
            transformRequestFunction: req => ({
              ...req,
              priority: 0,
            }),
          });
        }
        await upsertJobSourceURL(
          request.url,
          currentPage,
          'completed',
        );

        lastKnownListPage = currentPage;
        lastKnownTotalListPages = totalPages;
        const pageElapsed = Date.now() - pageStart;
        listPageCount++;
        listPageAvgDuration =
          (listPageAvgDuration * (listPageCount - 1) +
            pageElapsed) /
          listPageCount;
        log.info(
          `List page ${currentPage}/${totalPages} took ${formatDuration(pageElapsed)}. Est. finish: ${estimateFinishTime()}`,
        );
      } catch (error) {
        await upsertJobSourceURL(
          request.url,
          currentPage,
          'failed',
        );
        log.error(
          `Failed to extract data on ${request.url}: ${error}`,
        );
      }
    },
  );

  router.addHandler<JobOnAPI & RequireToCrawlJob>(
    'DETAIL',
    async ({ request, page, log }) => {
      log.info(
        `Processing detail page: ${request.loadedUrl || request.url}`,
      );
      const detailStart = Date.now();

      try {
        await page
          .waitForSelector(waitFordDetailPageSelector, {
            timeout: 10000,
          })
          .catch(() => {});

        const detail = await page.evaluate(
          extractJobDetailOnHTML,
        );

        const { job, company, jobKeyword } = cookRawJob(
          request.userData,
          detail,
          allGroupKeywords,
        );

        const existingJob = request.userData[
          'existingJob'
        ] as SupabaseTable.Job | undefined;

        if (job.description) {
          pendingCompanies.push(company);
          pendingJobs.push({
            ...job,
            closed: false,
          });
          pendingJobKeywords.push(jobKeyword);
        } else if (existingJob) {
          pendingJobs.push({
            ...existingJob,
            updated_at: new Date(),
            closed: true,
          });
        }

        if (pendingJobs.length >= batchSize) {
          await flushBatch(log);
        }

        const detailElapsed = Date.now() - detailStart;
        detailPageCount++;
        detailPageAvgDuration =
          (detailPageAvgDuration * (detailPageCount - 1) +
            detailElapsed) /
          detailPageCount;
        processedDetailPages++;
        log.info(
          `Detail ${processedDetailPages}/${Math.max(totalDetailPages, processedDetailPages)} took ${formatDuration(detailElapsed)}. Est. finish: ${estimateFinishTime()}`,
        );
      } catch (error) {
        log.error(
          `Failed to extract data on ${request.url}: ${error}`,
        );
      }
    },
  );
  return { router, flushBatch };
};
