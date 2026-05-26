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
  resetJobKeywords_Keywords_JobKeywordGroup,
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

function splitTopLevel(expr: string, sep: string): string[] {
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
  jobKeywords: Omit<SupabaseTable.JobKeyword, 'job'>[];
}

async function updateJobs(
  allGroupKeywords: string[],
  where?: Record<string, any>,
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const resolvedWhere = where ?? {
    updated_at: { lt: today.toISOString() },
  };
  const { result: jobs } = await fetchJobs({
    from: 0,
    to: -1,
    where: resolvedWhere,
    orders: [{ column: 'min_salary', ascending: false }],
  });

  console.log(`[update] ${jobs.length} job(s) to update`);

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
    await upsertJobs([...pending.jobs]);
    if (pending.jobKeywords.length > 0) {
      await upsertJobKeywords([...pending.jobKeywords]);
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
            const salary = detail.salary ?? '';
            pending.jobs.push({
              ...job,
              description: detail.description,
              salary,
              ...parseSalary(salary),
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

/**
 * Usage:
 *
 * pnpm nx serve crawler                                                          # 抓全部 (104 + Cake)
 * pnpm nx serve crawler --args="update"                                          # 批次更新 (updated_at < today)
 * pnpm nx serve crawler --args="update=EXPR"                                     # 批次更新，自訂 where 條件
 * pnpm nx serve crawler --args="id=<id>"                                         # 只更新指定 id 的 job
 *
 * EXPR 語法 (no spaces, single token):
 *   field.op.val                           → AND 條件
 *   (field.op.val|field.op.val)            → OR 群組
 *   (A|B),C                                → (A OR B) AND C
 *
 * 範例:
 *   update=closed.eq.true,min_salary.gt.50000
 *   update=(source.eq.104|source.eq.cake),min_salary.gt.50000
 *   update=id.in.(123,456)
 */
async function main() {
  const args = process.argv.slice(2);

  const updateArg = args.find(
    x => x === 'update' || x.startsWith('update='),
  );
  if (updateArg) {
    const { result: keywordGroups } =
      await fetchMvKeywordGroup({
        from: 0,
        to: -1,
        where: { category: { 'not.is': null } },
      });
    const keywords = keywordGroups.flatMap(m => m.keywords);
    const whereExpr = updateArg.includes('=')
      ? updateArg.slice(updateArg.indexOf('=') + 1)
      : undefined;
    await updateJobs(
      keywords,
      whereExpr ? parseWhereExpr(whereExpr) : undefined,
    );
  } else {
    const idArg = args.find(x => x.startsWith('id='));
    const keywordArg = args.find(x => x.startsWith('k'));
    const salaryArg = args.find(x =>
      x.startsWith('salary'),
    );
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
            ...parseKeywordsOut(
              x.description,
              groupKeywords,
            ),
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
      const keywords = keywordGroups.flatMap(
        m => m.keywords,
      );
      if (idArg) {
        const [, id] = idArg.split('=');
        if (!id) {
          console.error('Usage: main.js id=<id>');
          process.exit(1);
        }
        const idList =
          id === '*' ? ids.map(x => x.id) : [id];
        await updateJobs(keywords, {
          id: { in: `(${idList.join(',')})` },
        });
      } else {
        const makeCrawlerOptions = (
          requestHandler: any,
        ) => ({
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
          await fetchJobSourceURLs({
            from: 0,
            to: -1,
            where: { status: { eq: 'pending' } },
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
            url_with_page_index: setPageIndex(
              x.url,
              x.page_index,
            ),
          }));
        } else {
          console.log(
            '>>> Fresh mode: starting from page=1',
          );
          const { result: jobSources } =
            await fetchJobSources({ from: 0, to: -1 });
          jobSourceURLs = jobSources.map(x => ({
            url: x.url,
            page_index: 1,
            status: 'pending',
            host: x.host,
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
            jobSourceURLs104.map(
              x => x.url_with_page_index,
            ),
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
            jobSourceURLsCake.map(
              x => x.url_with_page_index,
            ),
          );
          await flushBatchCake();
        }
      }
    }

  }
  await resetJobKeywords_Keywords_JobKeywordGroup();
}

main().catch(error => {
  console.error('Crawler failed:', error);
  process.exit(1);
});
