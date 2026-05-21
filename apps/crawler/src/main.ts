import { Configuration, PuppeteerCrawler } from 'crawlee';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import rebrowserPuppeteer from 'rebrowser-puppeteer';

import { SupabaseTable } from '@codeshore/data-types';
import {
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
  waitFordDetailPageSelector as waitForSelectorOn104,
} from './104/utils';
import { createHandler as createHandlerCake } from './cake/handler';
import {
  extractJobDetailOnHTML as extractJobDetailOnCake,
  waitFordDetailPageSelector as waitForSelectorOnCake,
} from './cake/utils';
import { ids } from './ids';

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
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
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

        if (detailLinkHost === 'www.104.com.tw') {
          waitForSelector = waitForSelectorOn104;
          extractJobDetail = extractJobDetailOn104;
        } else if (detailLinkHost === 'www.cake.me') {
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
 * pnpm nx serve crawler --args=_104                               # 只抓 104
 * pnpm nx serve crawler --args=cake                               # 只抓 Cake
 * pnpm nx serve crawler --args="page=<n>"                         # 從 URL index 0, 第 n 頁開始抓
 * pnpm nx serve crawler --args="page=<urlIndex>:<pageNum>"        # 從 URL index <urlIndex>, 第 <pageNum> 頁開始抓; index 前的 URL 跳過; index 後的 URL 從第 1 頁開始
 * pnpm nx serve crawler --args="_104 page=1:3"                    # 104 從 URL index 1 的第 3 頁開始抓
 * pnpm nx serve crawler --args="id=<id>"                          # 只更新指定 id 的 job
 *
 * node dist/apps/crawler/main.js                                  # 抓全部 (104 + Cake)
 * node dist/apps/crawler/main.js _104                             # 只抓 104
 * node dist/apps/crawler/main.js cake                             # 只抓 Cake
 * node dist/apps/crawler/main.js page=3                           # 從 URL index 0, 第 3 頁開始抓全部
 * node dist/apps/crawler/main.js page=1:3                         # 從 URL index 1, 第 3 頁開始抓全部
 * node dist/apps/crawler/main.js _104 page=1:3                    # 104 從 URL index 1, 第 3 頁開始抓
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
      const isCake = args.some(arg => arg.includes('cake'));
      const is104 = args.some(arg => arg.includes('_104'));
      const runAll = !isCake && !is104;

      const pageArg = args.find(x => x.startsWith('page='));
      let startUrlIndex = 0;
      let startPage = 1;
      if (pageArg) {
        const val = pageArg.split('=')[1];
        if (val.includes(':')) {
          const [idxStr, pageStr] = val.split(':');
          startUrlIndex = parseInt(idxStr, 10);
          startPage = parseInt(pageStr, 10);
        } else {
          startPage = parseInt(val, 10);
        }
      }

      const parseEnvUrls = (
        envVar: string | undefined,
      ): string[] =>
        (envVar || '')
          .split('|')
          .map(u => u.trim())
          .filter(Boolean);

      const buildStartUrls = (baseUrls: string[]) =>
        baseUrls
          .filter((_, i) => i >= startUrlIndex)
          .map((baseUrl, i) => {
            const url = new URL(baseUrl);
            url.searchParams.set(
              'page',
              (i === 0 ? startPage : 1).toString(),
            );
            return url.toString();
          });

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

      if (is104 || runAll) {
        const startUrls104 = buildStartUrls(
          parseEnvUrls(process.env['START_URL_104']),
        );
        console.log(
          `>>> Starting 104 crawler from URL index ${startUrlIndex}, page ${startPage} (${startUrls104.length} URL(s))...`,
        );
        const {
          router: requestHandler104,
          flushBatch: flushBatch104,
        } = createHandler104(keywords);
        for (let i = 0; i < startUrls104.length; i++) {
          console.log(
            `>>> 104 URL [${startUrlIndex + i}]: ${startUrls104[i]}`,
          );
          Configuration.getGlobalConfig().set(
            'purgeOnStart',
            true,
          );
          const crawler = new PuppeteerCrawler(
            makeCrawlerOptions(requestHandler104),
          );
          await crawler.run([startUrls104[i]]);
        }
        await flushBatch104();
      }

      if (isCake || runAll) {
        const startUrlsCake = buildStartUrls(
          parseEnvUrls(process.env['START_URL_CAKE']),
        );
        console.log(
          `>>> Starting Cake crawler from URL index ${startUrlIndex}, page ${startPage} (${startUrlsCake.length} URL(s))...`,
        );
        const {
          router: requestHandlerCake,
          flushBatch: flushBatchCake,
        } = createHandlerCake(keywords);
        for (let i = 0; i < startUrlsCake.length; i++) {
          console.log(
            `>>> Cake URL [${startUrlIndex + i}]: ${startUrlsCake[i]}`,
          );
          Configuration.getGlobalConfig().set(
            'purgeOnStart',
            true,
          );
          const crawler = new PuppeteerCrawler(
            makeCrawlerOptions(requestHandlerCake),
          );
          await crawler.run([startUrlsCake[i]]);
        }
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
