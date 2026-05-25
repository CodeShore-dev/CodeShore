import { Configuration, PuppeteerCrawler } from 'crawlee';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import rebrowserPuppeteer from 'rebrowser-puppeteer';
import { SupabaseTable } from '@codeshore/data-types';
import {
  fetchJobSourceURLs,
  fetchJobSources,
  fetchJobs,
  fetchMvKeywordGroup,
  resetJobKeywords_Keywords_JobJoinKeywordGroup,
  upsertJobKeywords,
  upsertJobs,
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
import { ids } from './ids';
import { setPageIndex } from './utils';

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

async function crawlJobByIds(
  ids: string[],
  allGroupKeywords: string[],
) {
  Configuration.getGlobalConfig().set('purgeOnStart', true);

  const { result: jobs, query } = await fetchJobs({
    to: ids.length,
    where: { id: { in: `(${ids.join(',')})` } },
  });
  if (jobs.length === 0) {
    console.error(
      `Jobs not found: ${ids}, query: ${query}`,
    );
    process.exit(1);
  }

  const crawler = new PuppeteerCrawler({
    launchContext: stealthLaunchContext as any,
    preNavigationHooks: [applyStealthOnNavigation as any],
    async requestHandler({ request, page, log }) {
      log.info(
        `Processing detail page: ${request.loadedUrl || request.url}`,
      );

      const detailLinkHost = new URL(request.url).hostname;

      try {
        let waitForSelector = '';
        let extractJobDetail: () => {
          description: string;
          salary: string;
        } = () => ({
          description: '',
          salary: '',
        });

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

        const job = request.userData[
          'job'
        ] as SupabaseTable.Job;
        if (detail.description.trim()) {
          const salary = detail.salary ?? '';
          await upsertJobs([
            {
              ...job,
              description: detail.description,
              salary,
              ...parseSalary(salary),
              updated_at: new Date(),
              closed: false,
            },
          ]);

          if (detail.description !== job.description) {
            await upsertJobKeywords([
              {
                id: job.id,
                ...parseKeywordsOut(
                  detail.description,
                  allGroupKeywords,
                ),
              },
            ]);
          }
          log.info(`Saved info for: ${job.title}`);
        } else {
          await upsertJobs([
            {
              ...job,
              updated_at: new Date(),
              closed: true,
            },
          ]);
          log.warning(
            `Closed the job: ${job.title} because of no description, please check ${request.url}`,
          );
        }
      } catch (error) {
        log.error(
          `Failed to extract data on ${request.url}: ${error}`,
        );
      }
    },
    maxConcurrency: 1,
    requestHandlerTimeoutSecs: 60,
    headless: true,
  });

  await crawler.run(
    jobs.map(job => ({
      url: job.detail_link,
      userData: { job },
    })),
  );
}

/**
 * Usage:
 *
 * pnpm nx serve crawler                                            # 抓全部 (104 + Cake)
 * pnpm nx serve crawler --args="id=<id>"                          # 只更新指定 id 的 job
 *
 * node dist/apps/crawler/main.js                                  # 抓全部 (104 + Cake)
 * node dist/apps/crawler/main.js id=<id>                          # 只更新指定 id 的 job
 */
async function main() {
  const args = process.argv.slice(2);

  const idArg = args.find(x => x.startsWith('id='));
  const keywordArg = args.find(x => x.startsWith('k'));
  const salaryArg = args.find(x => x.startsWith('salary'));
  if (keywordArg || salaryArg) {
    const { result: keywordGroups } =
      await fetchMvKeywordGroup({
        from: 0,
        to: -1,
        where: { category: { 'not.is': null } },
      });
    const groupKeywords = keywordGroups.flatMap(
      m => m.keywords,
    );
    const { result } = await fetchJobs({
      from: 0,
      to: -1,
    });
    if (salaryArg) {
      await upsertJobs(
        result.map(x => ({
          ...x,
          ...parseSalary(x.salary),
        })),
      );
    } else if (keywordArg) {
      await upsertJobKeywords(
        result.map(x => ({
          id: x.id,
          ...parseKeywordsOut(x.description, groupKeywords),
        })),
      );
    }
  } else {
    const { result: keywordGroups } =
      await fetchMvKeywordGroup({
        from: 0,
        to: -1,
        where: { category: { 'not.is': null } },
      });
    const keywords = keywordGroups.flatMap(m => m.keywords);
    if (idArg) {
      const [, id] = idArg.split('=');
      if (!id) {
        console.error('Usage: main.js id=<id>');
        process.exit(1);
      }
      await crawlJobByIds(
        id === '*' ? ids.map(x => x.id) : [id],
        keywords,
      );
    } else {
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

      // 1. Check for pending job_source_url entries
      const { result: pendingJobSourceURLs } =
        await fetchJobSourceURLs({
          from: 0,
          to: -1,
          where: { status: { eq: 'pending' } },
        });

      // 2. Build starting URLs based on mode
      let jobSourceURLs: (SupabaseTable.JobSourceURL & {
        host: string;
        url_with_page_index: string;
      })[];

      if (pendingJobSourceURLs.length > 0) {
        // Resume mode (Req 1.1): use pending entries
        console.log(
          `>>> Resume mode: ${pendingJobSourceURLs.length} pending URL(s)`,
        );
        jobSourceURLs = pendingJobSourceURLs.map(x => ({
          ...x,
          url_with_page_index: setPageIndex(
            x.url,
            x.page_index,
          ),
        }));
      } else {
        // Fresh mode (Req 1.2, 1.3, 1.4): use job_source URLs at page=1
        console.log('>>> Fresh mode: starting from page=1');
        const { result: jobSources } = await fetchJobSources(
          { from: 0, to: -1 },
        );
        jobSourceURLs = jobSources.map(x => ({
          url: x.url,
          page_index: 1,
          status: 'pending',
          host: x.host,
          url_with_page_index: setPageIndex(x.url, 1),
        }));
      }

      // 3. Split by platform
      const jobSourceURLs104 = jobSourceURLs.filter(x =>
        is104Host(x.host),
      );

      const jobSourceURLsCake = jobSourceURLs.filter(x =>
        isCakeHost(x.host),
      );

      // 4. ONE crawler per platform (pass ALL starting URLs)
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
    }
  }

  await resetJobKeywords_Keywords_JobJoinKeywordGroup();
}

main().catch(error => {
  console.error('Crawler failed:', error);
  process.exit(1);
});
