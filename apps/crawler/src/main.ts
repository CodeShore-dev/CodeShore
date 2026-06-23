import { Configuration, PuppeteerCrawler } from 'crawlee';
import dayjs from 'dayjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import rebrowserPuppeteer from 'rebrowser-puppeteer';

import { SupabaseTable } from '@codeshore/data-types';
import {
  JobKeywordService,
  JobService,
  JobSourceService,
  JobSourceURLService,
  MvTechService,
} from '@codeshore/data-utils';
import {
  parseKeywordsOut,
  parseSalary,
} from '@codeshore/shared-utils';

import { createHandler as createHandler104 } from './104/handler';
import {
  extractJobDetailOnHTML as extractJobDetailOn104,
  isTheHost as is104Host,
  waitFordDetailPageSelector as waitForSelectorOn104,
} from './104/utils';
import { createHandler as createHandlerCake } from './cake/handler';
import {
  extractJobDetailOnHTML as extractJobDetailOnCake,
  isTheHost as isCakeHost,
  waitFordDetailPageSelector as waitForSelectorOnCake,
} from './cake/utils';
import { formatDuration, setPageIndex } from './utils';

const puppeteer = addExtra(rebrowserPuppeteer as any);
puppeteer.use(StealthPlugin());

const envPath = path.resolve(__dirname, '../.env');

dotenv.config({
  path: envPath,
});

const stealthLaunchContext = {
  launcher: puppeteer,
  launchOptions: {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
      '--no-first-run',
      '--lang=zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    ],
    executablePath:
      process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
  },
};

async function applyStealthOnNavigation({
  page,
}: {
  page: import('puppeteer').Page;
  request: import('crawlee').Request;
}) {
  await page.setViewport({ width: 1280, height: 800 });

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
    'sec-ch-ua':
      '"Chromium";v="124", "Google Chrome";v="124"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  });
}

function splitTopLevel(
  expr: string,
  sep: string,
): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function parseWhereExpr(expr: string): Record<string, any> {
  const where: Record<string, any> = {};
  for (const cond of splitTopLevel(expr, ',')) {
    if (cond.startsWith('(') && cond.endsWith(')')) {
      // OR group: (source.eq.104|source.eq.cake) → $or: "source.eq.104,source.eq.cake"
      where['$or'] = cond.slice(1, -1).split('|').join(',');
    } else {
      // Field filter: col.op.val  (val may contain dots, e.g. id.in.(1,2))
      const d1 = cond.indexOf('.');
      const d2 = cond.indexOf('.', d1 + 1);
      where[cond.slice(0, d1)] = {
        [cond.slice(d1 + 1, d2)]: cond.slice(d2 + 1),
      };
    }
  }
  return where;
}

interface PendingBatch {
  jobs: SupabaseTable.Job[];
  jobKeywords: Omit<SupabaseTable.Job_.Keyword, 'job'>[];
}

async function reCrawlJobs(
  allGroupKeywords: string[],
  where?: Record<string, any>,
): Promise<void> {
  const todayDayjs = dayjs();
  const yesterday = todayDayjs.subtract(1, 'day').toDate();
  yesterday.setHours(0, 0, 0, 0);
  const resolvedWhere = where ?? {
    updated_at: { lt: yesterday.toISOString() },
  };
  const { result: jobs } = await new JobService().fetchAll({
    where: resolvedWhere,
    orders: [{ column: 'min_salary', ascending: false }],
  });

  console.log(
    `[update] ${jobs.length} job(s) to update (${JSON.stringify(resolvedWhere)})`,
  );

  let processedCount = 0;
  let rollingAvgMs = 0;
  const totalCount = jobs.length;
  const BATCH_SIZE = 20;

  const pending: PendingBatch = {
    jobs: [],
    jobKeywords: [],
  };

  async function flushPendingBatch(
    pending: PendingBatch,
    log: { info: (msg: string) => void },
  ): Promise<void> {
    if (pending.jobs.length === 0) return;
    await new JobService().upsert([...pending.jobs]);
    if (pending.jobKeywords.length > 0) {
      await new JobKeywordService().upsert([
        ...pending.jobKeywords,
      ]);
    }
    log.info(
      `[update] Flushed ${pending.jobs.length} jobs`,
    );
    pending.jobs.length = 0;
    pending.jobKeywords.length = 0;
  }

  Configuration.getGlobalConfig().set('purgeOnStart', true);

  const crawler = new PuppeteerCrawler({
    launchContext: stealthLaunchContext as any,
    preNavigationHooks: [applyStealthOnNavigation as any],
    async requestHandler({ request, page, log }) {
      const job = request.userData[
        'job'
      ] as SupabaseTable.Job;
      const detailStart = Date.now();
      const detailLinkHost = new URL(request.url).hostname;

      try {
        let waitForSelector: string;
        let extractJobDetail: () => {
          description: string;
          salary: string;
          location: string;
        };

        if (is104Host(detailLinkHost)) {
          waitForSelector = waitForSelectorOn104;
          extractJobDetail = extractJobDetailOn104;
        } else if (isCakeHost(detailLinkHost)) {
          waitForSelector = waitForSelectorOnCake;
          extractJobDetail = extractJobDetailOnCake;
        } else {
          throw new Error(
            `Unknown detail link host: ${detailLinkHost}`,
          );
        }

        await page
          .waitForSelector(waitForSelector, {
            timeout: 10000,
          })
          .catch(() => {});

        const detail = await page.evaluate(
          extractJobDetail,
        );

        if (detail.description.trim()) {
          const descriptionChanged =
            detail.description !== job.description;
          const salaryChanged =
            !job.salary_manual &&
            detail.salary !== job.salary;
          const locationChanged =
            detail.location !== job.location;
          const changedFields = [
            {
              field: 'description',
              changed: descriptionChanged,
            },
            { field: 'salary', changed: salaryChanged },
            { field: 'location', changed: locationChanged },
          ]
            .filter(x => x.changed)
            .map(x => x.field)
            .join(',');
          if (
            descriptionChanged ||
            salaryChanged ||
            locationChanged
          ) {
            const salaryUpdate = salaryChanged
              ? {
                  salary: detail.salary ?? '',
                  ...parseSalary(detail.salary ?? ''),
                }
              : {};
            pending.jobs.push({
              ...job,
              description: detail.description,
              location: detail.location,
              ...salaryUpdate,
              updated_at: new Date(),
              closed: false,
            });
            pending.jobKeywords.push({
              id: job.id,
              ...parseKeywordsOut(
                detail.description,
                allGroupKeywords,
              ),
            });
            log.info(
              `[${job.id}]${job.title} is updated. changed fields: ${changedFields}`,
            );
          } else {
            pending.jobs.push({
              ...job,
              updated_at: new Date(),
              closed: false,
            });
          }
        } else {
          pending.jobs.push({
            ...job,
            updated_at: new Date(),
            closed: true,
          });
          log.warning(
            `${job.title} is closed, link: ${request.url}`,
          );
        }

        if (pending.jobs.length >= BATCH_SIZE) {
          await flushPendingBatch(pending, log);
        }
      } catch (error) {
        log.error(
          `Failed to update job ${job.id} (${request.url}): ${error}`,
        );
      }

      const elapsed = Date.now() - detailStart;
      processedCount++;
      rollingAvgMs =
        (rollingAvgMs * (processedCount - 1) + elapsed) /
        processedCount;
      const eta =
        rollingAvgMs * (totalCount - processedCount);
      log.info(
        `[update] ${processedCount} / ${totalCount} | avg: ${formatDuration(Math.round(rollingAvgMs))} | eta: ${formatDuration(Math.round(eta))}`,
      );
    },
    maxConcurrency: 1,
    requestHandlerTimeoutSecs: 60,
  });

  await crawler.run(
    jobs.map(job => ({
      url: job.detail_link,
      userData: { job },
    })),
  );

  const log = { info: (msg: string) => console.log(msg) };
  await flushPendingBatch(pending, log);
}

async function main() {
  const args = process.argv.slice(2);

  const reCrawlJobsArg = args.find(
    x => x === 're-crawl' || x.startsWith('re-crawl='),
  );
  const resetMinMaxSalaryArg = args.find(x =>
    x.startsWith('job-salary'),
  );
  const resetJobKeywordArg = args.find(x =>
    x.startsWith('job-keyword'),
  );
  const crawlArg = args.find(
    x => x === 'crawl' || x.startsWith('crawl='),
  );

  type Mode =
    | 're-crawl'
    | 'job-salary'
    | 'job-keyword'
    | 'crawl';
  let mode: Mode;
  if (reCrawlJobsArg) mode = 're-crawl';
  else if (resetMinMaxSalaryArg) mode = 'job-salary';
  else if (resetJobKeywordArg) mode = 'job-keyword';
  else mode = 'crawl';

  const { result: techs } =
    await new MvTechService().fetchAll({
      where: { category: { 'not.is': null } },
    });
  const keywords = techs.flatMap(m => m.keywords);

  switch (mode) {
    case 're-crawl': {
      const whereExpr = reCrawlJobsArg!.includes('=')
        ? reCrawlJobsArg!.slice(
            reCrawlJobsArg!.indexOf('=') + 1,
          )
        : undefined;
      await reCrawlJobs(
        keywords,
        whereExpr ? parseWhereExpr(whereExpr) : undefined,
      );
      break;
    }

    case 'job-salary': {
      const { result } = await new JobService().fetchAll({
        select: 'id,salary,salary_manual',
      });
      await new JobService().updateMultiple(
        result
          .filter(x => !x.salary_manual)
          .map(x => ({
            id: x.id,
            ...parseSalary(x.salary),
          })),
      );
      break;
    }

    case 'job-keyword': {
      const { result } = await new JobService().fetchAll({
        select: 'id,description',
      });
      await new JobKeywordService().updateMultiple(
        result.map(x => ({
          id: x.id,
          ...parseKeywordsOut(x.description, keywords),
        })),
      );
      break;
    }

    case 'crawl': {
      const crawlSubMode = crawlArg?.includes('=')
        ? crawlArg.slice(crawlArg.indexOf('=') + 1)
        : undefined;
      const isFresh = crawlSubMode === 'fresh';

      if (isFresh) {
        console.log(
          '>>> Fresh mode: clearing job_source_url...',
        );
        await new JobSourceURLService().clearAll();
      } else {
        console.log('>>> Resume mode');
      }

      const makeCrawlerOptions = (requestHandler: any) => ({
        launchContext: stealthLaunchContext as any,
        browserPoolOptions: {
          useFingerprints: false,
        },
        preNavigationHooks: [
          applyStealthOnNavigation as any,
        ],
        requestHandler,
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 120,
      });

      const { result: pendingJobSourceURLs } =
        await new JobSourceURLService().fetchAll({
          where: { status: { eq: 'pending' } },
          orders: [
            { column: 'url', ascending: true },
            { column: 'page_index', ascending: true },
          ],
        });

      let jobSourceURLs: (SupabaseTable.JobSourceURL & {
        host: string;
        url_with_page_index: string;
      })[];

      if (pendingJobSourceURLs.length > 0) {
        console.log(
          `>>> Resume mode: ${pendingJobSourceURLs.length} pending URL(s)`,
        );
        jobSourceURLs = pendingJobSourceURLs.map(x => ({
          ...x,
          host: new URL(x.url).host,
          url_with_page_index: setPageIndex(
            x.url,
            x.page_index,
          ),
        }));
      } else if (!isFresh) {
        console.log(
          '>>> Resume mode: no pending URL(s) to resume, nothing to do',
        );
        jobSourceURLs = [];
      } else {
        console.log('>>> Fresh mode: starting from page=1');
        const { result: jobSources } =
          await new JobSourceService().fetchAll();
        jobSourceURLs = jobSources.map(x => ({
          url: x.url,
          page_index: 1,
          status: 'pending',
          host: new URL(x.url).host,
          url_with_page_index: setPageIndex(x.url, 1),
        }));
      }

      const jobSourceURLs104 = jobSourceURLs.filter(x =>
        is104Host(x.host),
      );

      const jobSourceURLsCake = jobSourceURLs.filter(x =>
        isCakeHost(x.host),
      );

      if (jobSourceURLs104.length > 0) {
        console.log(
          `>>> Starting 104 crawler from URL(${jobSourceURLs104.length} URL(s))...`,
        );
        const {
          router: requestHandler104,
          flushBatch: flushBatch104,
        } = createHandler104(keywords);
        Configuration.getGlobalConfig().set(
          'purgeOnStart',
          true,
        );
        const crawler = new PuppeteerCrawler(
          makeCrawlerOptions(requestHandler104),
        );
        await crawler.run(
          jobSourceURLs104.map(x => x.url_with_page_index),
        );
        await flushBatch104();
      }

      if (jobSourceURLsCake.length > 0) {
        console.log(
          `>>> Starting Cake crawler from URL(${jobSourceURLsCake.length} URL(s))...`,
        );
        const {
          router: requestHandlerCake,
          flushBatch: flushBatchCake,
        } = createHandlerCake(keywords);
        Configuration.getGlobalConfig().set(
          'purgeOnStart',
          true,
        );
        const crawler = new PuppeteerCrawler(
          makeCrawlerOptions(requestHandlerCake),
        );
        await crawler.run(
          jobSourceURLsCake.map(x => x.url_with_page_index),
        );
        await flushBatchCake();
      }
      break;
    }
  }
}

main().catch(error => {
  console.error('Crawler failed:', error);
  process.exit(1);
});
