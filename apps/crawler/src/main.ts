import { Configuration, PuppeteerCrawler } from 'crawlee';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { DEFAULT_MODEL_FALLBACK, DEFAULT_MODEL_SETTING_KEY, OpenRouterLlmClient } from '@codeshore/ai-client';
import {
  createLinearBackoffSchedule,
  createStealthLaunchContext,
  createStealthPreNavigationHook,
  getSourceKey,
  randomDelay,
  runWithRateLimitBackoff,
  setPageIndex,
} from '@codeshore/crawler-core';
import type { CrawlRouterResult, RunWithRateLimitBackoffOptions } from '@codeshore/crawler-core';
import { AiLlmSettingService, JobService, MvTechService, generateJobKeywordsFromLines } from '@codeshore/data-utils';
import { parseSalary } from '@codeshore/shared-utils';
import type { SourceLocation } from '@codeshore/sync-core';
import { createStalenessSyncEngine, resolveSourcesToProcess } from '@codeshore/sync-core';

import { createHandler as createHandler104 } from './104/handler';
import { isTheHost as is104Host } from './104/utils';
import { createHandler as createHandlerCake } from './cake/handler';
import { createHomepageWarmupHook as createCakeHomepageWarmupHook, isTheHost as isCakeHost } from './cake/utils';
import { Preference, fetchJobIdsByUserPreference, writeJobIdsCsv } from './export-preferenced-jobs';
import { ingestHandoffFile } from './handoff/ingest-handoff-file';
import { sourceRegistry } from './persistence';
import { buildJobIdWhere, readJobIdsFromCsvFile } from './re-crawl-from-file';
import { createJobStalenessSyncConfig } from './staleness-sync';

// `__dirname` 不可靠:esbuild production build 會把 main.js 攤平到
// dist/apps/crawler 根目錄(不保留 src/ 巢狀結構),導致相對路徑跑掉。
// Nx target 一律從 workspace root 執行,故改以 process.cwd() 為基準。
const envPath = path.resolve(process.cwd(), 'apps/crawler/.env');

dotenv.config({
  path: envPath,
});

export function splitTopLevel(expr: string, sep: string): string[] {
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

export function parseWhereExpr(expr: string): Record<string, any> {
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

/**
 * 被限流(HTTP 429)/ 被 Cloudflare 擋下後的退讓重試設定,預設「5 分鐘起、
 * 每次再多 5 分鐘、不設重試上限」;可用環境變數覆寫(單位皆為分鐘,可含小數):
 *
 * - `CRAWL_BACKOFF_INITIAL_MINUTES`   第 1 次重試前等多久(預設 5)
 * - `CRAWL_BACKOFF_INCREMENT_MINUTES` 之後每次重試再多等多久(預設 5)
 * - `CRAWL_BACKOFF_MAX_DELAY_MINUTES` 單次等待上限(預設不設上限)
 * - `CRAWL_BACKOFF_MAX_RETRIES`       最多重試幾次(預設不設上限,一直重試到成功)
 *
 * 等待時程的計算集中在 `createLinearBackoffSchedule`;若之後要改成指數退讓
 * 等其他策略,換掉這裡的 `delayForRetry` 即可。
 */
export const CRAWL_BACKOFF_DEFAULTS = {
  initialMinutes: 5,
  incrementMinutes: 5,
} as const;

const MINUTE_MS = 60_000;

function readMinutesEnv(env: NodeJS.ProcessEnv, key: string): number | undefined {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be a non-negative number of minutes, got "${raw}"`);
  }
  return value;
}

export function resolveCrawlBackoffOptions(env: NodeJS.ProcessEnv = process.env): Pick<
  RunWithRateLimitBackoffOptions,
  'delayForRetry' | 'maxRetries'
> & {
  initialDelayMs: number;
  incrementMs: number;
  maxDelayMs: number | undefined;
} {
  const initialDelayMs =
    (readMinutesEnv(env, 'CRAWL_BACKOFF_INITIAL_MINUTES') ?? CRAWL_BACKOFF_DEFAULTS.initialMinutes) * MINUTE_MS;
  const incrementMs =
    (readMinutesEnv(env, 'CRAWL_BACKOFF_INCREMENT_MINUTES') ?? CRAWL_BACKOFF_DEFAULTS.incrementMinutes) * MINUTE_MS;
  const maxDelayMinutes = readMinutesEnv(env, 'CRAWL_BACKOFF_MAX_DELAY_MINUTES');
  const maxDelayMs = maxDelayMinutes === undefined ? undefined : maxDelayMinutes * MINUTE_MS;

  const rawMaxRetries = env['CRAWL_BACKOFF_MAX_RETRIES'];
  let maxRetries: number | undefined;
  if (rawMaxRetries !== undefined && rawMaxRetries.trim() !== '') {
    maxRetries = Number(rawMaxRetries);
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new Error(`CRAWL_BACKOFF_MAX_RETRIES must be a non-negative integer, got "${rawMaxRetries}"`);
    }
  }

  return {
    initialDelayMs,
    incrementMs,
    maxDelayMs,
    maxRetries,
    delayForRetry: createLinearBackoffSchedule({ initialDelayMs, incrementMs, maxDelayMs }),
  };
}

interface StealthCrawlConfig {
  launchContext: ReturnType<typeof createStealthLaunchContext>;
  preNavigationHook: ReturnType<typeof createStealthPreNavigationHook>;
}

export type Mode =
  | 're-crawl'
  | 're-crawl-from-file'
  | 'export-preferenced-jobs'
  | 'job-salary'
  | 'job-keyword'
  | 'crawl'
  | 'crawl-from-file';

export interface ResolvedCliArgs {
  mode: Mode;
  reCrawlJobsArg: string | undefined;
  reCrawlFromFileArg: string | undefined;
  exportLikedJobsArg: string | undefined;
  crawlArg: string | undefined;
  crawlFromFileArg: string | undefined;
}

/**
 * 依 CLI 參數決定執行模式與各模式所需的原始參數字串,純函式、不含副作用,
 * 對應 `main()` 原本內聯的 `args.find(...)` + if/else 判斷邏輯。
 */
export function resolveCliArgs(args: string[]): ResolvedCliArgs {
  const reCrawlJobsArg = args.find(x => x === 're-crawl' || x.startsWith('re-crawl='));
  const reCrawlFromFileArg = args.find(x => x === 're-crawl-from-file' || x.startsWith('re-crawl-from-file='));
  const exportLikedJobsArg = args.find(x => x === 'export-preferenced-jobs');
  const resetMinMaxSalaryArg = args.find(x => x.startsWith('job-salary'));
  const resetJobKeywordArg = args.find(x => x.startsWith('job-keyword'));
  const crawlArg = args.find(x => x === 'crawl' || x.startsWith('crawl='));
  const crawlFromFileArg = args.find(x => x === 'crawl-from-file' || x.startsWith('crawl-from-file='));

  let mode: Mode;
  if (reCrawlJobsArg) mode = 're-crawl';
  else if (reCrawlFromFileArg) mode = 're-crawl-from-file';
  else if (exportLikedJobsArg) mode = 'export-preferenced-jobs';
  else if (resetMinMaxSalaryArg) mode = 'job-salary';
  else if (resetJobKeywordArg) mode = 'job-keyword';
  else if (crawlFromFileArg) mode = 'crawl-from-file';
  else mode = 'crawl';

  return {
    mode,
    reCrawlJobsArg,
    reCrawlFromFileArg,
    exportLikedJobsArg,
    crawlArg,
    crawlFromFileArg,
  };
}

async function main() {
  const stealthConfig: StealthCrawlConfig = {
    launchContext: createStealthLaunchContext({
      executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
      userDataDir: process.env['PUPPETEER_USER_DATA_DIR'] || undefined,
      headless: true,
    }),
    preNavigationHook: createStealthPreNavigationHook(),
  };

  const cliArgs = process.argv.slice(2);
  const { mode, reCrawlJobsArg, reCrawlFromFileArg, crawlArg, crawlFromFileArg } = resolveCliArgs(cliArgs);

  const { result: techs } = await new MvTechService().fetchAll({
    where: { category: { 'not.is': null } },
  });
  const keywords = techs.flatMap(m => m.keywords);

  switch (mode) {
    case 're-crawl': {
      const whereExpr = reCrawlJobsArg!.includes('=')
        ? reCrawlJobsArg!.slice(reCrawlJobsArg!.indexOf('=') + 1)
        : undefined;
      const stalenessConfig = createJobStalenessSyncConfig(keywords, whereExpr ? parseWhereExpr(whereExpr) : undefined);
      await createStalenessSyncEngine(stalenessConfig).run(
        stealthConfig.launchContext,
        stealthConfig.preNavigationHook,
      );
      break;
    }

    case 're-crawl-from-file': {
      let filePath = '';
      if (!reCrawlFromFileArg!.includes('=')) {
        filePath = './liked-jobs.csv';
      } else {
        filePath = reCrawlFromFileArg!.slice(reCrawlFromFileArg!.indexOf('=') + 1);
      }

      console.log(`>>> Reading job ids from CSV: ${filePath}`);
      const jobIds = await readJobIdsFromCsvFile(filePath);
      console.log(`>>> Re-crawling ${jobIds.length} job(s) from CSV.`);

      const stalenessConfig = createJobStalenessSyncConfig(keywords, buildJobIdWhere(jobIds));
      await createStalenessSyncEngine(stalenessConfig).run(
        stealthConfig.launchContext,
        stealthConfig.preNavigationHook,
      );
      break;
    }

    case 'export-preferenced-jobs': {
      const userId = cliArgs.find(x => x.startsWith('user='))?.slice('user='.length);
      const preference = (cliArgs.find(x => x.startsWith('preference='))?.slice('preference='.length) ??
        'like') as Preference;
      const outputPath = cliArgs.find(x => x.startsWith('out='))?.slice('out='.length) ?? `./${preference}d-jobs.csv`;

      if (!userId || !outputPath) {
        throw new Error(
          'export-preferenced-jobs mode requires user=<userId> and out=<path>: ' +
            'use export-preferenced-jobs user=<userId> out=<path> ' +
            '[preference=like|dislike] (defaults to "like").',
        );
      }
      if (preference !== 'like' && preference !== 'dislike') {
        throw new Error(
          `export-preferenced-jobs mode received an invalid preference "${preference}" ` + '(expected "like" or "dislike").',
        );
      }

      console.log(`>>> Fetching "${preference}" job ids for user ${userId}...`);
      const jobIds = await fetchJobIdsByUserPreference(userId, preference);
      console.log(`>>> Found ${jobIds.length} job(s). Writing to ${outputPath}...`);
      await writeJobIdsCsv(jobIds, outputPath);
      console.log(`>>> Done. Re-crawl them with: re-crawl-from-file=${outputPath}`);
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
      const model = (await new AiLlmSettingService().getValue(DEFAULT_MODEL_SETTING_KEY)) ?? DEFAULT_MODEL_FALLBACK;
      const llmClient = new OpenRouterLlmClient(model);
      await generateJobKeywordsFromLines({ llmClient });
      break;
    }

    case 'crawl': {
      const crawlSubMode = crawlArg?.includes('=') ? crawlArg.slice(crawlArg.indexOf('=') + 1) : undefined;
      const isFresh = crawlSubMode === 'fresh';
      const useUiFilters = cliArgs.includes('ui-filters');

      if (isFresh) {
        console.log('>>> Fresh mode: clearing job_source_url...');
      } else {
        console.log('>>> Resume mode');
      }

      const makeCrawlerOptions = (requestHandler: any, extraPreNavigationHooks: any[] = []) => ({
        launchContext: stealthConfig.launchContext as any,
        browserPoolOptions: {
          useFingerprints: false,
        },
        preNavigationHooks: [
          stealthConfig.preNavigationHook as any,
          ...extraPreNavigationHooks,
          // 每次導航前隨機停頓 1.5~4 秒,模擬人類瀏覽節奏、拉開同一 IP 的請求
          // 間隔,降低被 Cloudflare 判定為機器人流量而擋下的機率。
          async () => {
            await randomDelay();
          },
        ],
        requestHandler,
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 120,
      });

      // 必須在 resolveSourcesToProcess 清空追蹤表之前先取得,否則 fresh 模式
      // 重新從第 1 頁爬時,無從得知「上次已經抓到第幾頁」,連續空頁的放棄判斷
      // 就可能在真正走到那個深度之前就誤觸發(見 crawl-router.ts 的
      // `knownPageFloors` 說明)。resume 模式不會清空任何東西,不需要這個下限。
      const knownPageFloors = isFresh ? await sourceRegistry.fetchMaxKnownPageIndex() : undefined;

      const sourceLocations = await resolveSourcesToProcess(sourceRegistry, isFresh ? 'fresh' : 'resume');

      if (isFresh) {
        console.log('>>> Fresh mode: starting from page=1');
      } else if (sourceLocations.length > 0) {
        console.log(`>>> Resume mode: ${sourceLocations.length} pending URL(s)`);
      } else {
        console.log('>>> Resume mode: no pending URL(s) to resume, nothing to do');
      }

      const backoff = resolveCrawlBackoffOptions();
      console.log(
        `>>> Rate-limit backoff: first wait ${backoff.initialDelayMs / MINUTE_MS}m, ` +
          `+${backoff.incrementMs / MINUTE_MS}m per retry` +
          (backoff.maxDelayMs !== undefined ? `, capped at ${backoff.maxDelayMs / MINUTE_MS}m` : '') +
          (backoff.maxRetries !== undefined ? `, max ${backoff.maxRetries} retries` : ', unlimited retries'),
      );

      const toJobSourceURLs = (locations: SourceLocation[]) =>
        locations.map(x => ({
          host: new URL(x.url).host,
          url_with_page_index: setPageIndex(x.url, x.pageIndex),
        }));

      // 每個站各跑一個退讓重試迴圈:第一次嘗試沿用上面(fresh 或 resume)算好
      // 的來源清單;之後每次重試都以 resume 模式重新查一次待爬清單、重建全新的
      // handler 與 PuppeteerCrawler——與操作者被限流後「手動再跑一次」完全等價,
      // 因此被中斷的清單頁 / 詳情頁會由既有的續爬機制自然撿回。
      const runSiteCrawlerWithBackoff = async (
        label: string,
        matchHost: (host: string) => boolean,
        createHandler: (
          urls: { host: string; url_with_page_index: string }[],
        ) => Pick<CrawlRouterResult, 'router' | 'flushPending' | 'takeStopReason'>,
        extraPreNavigationHooks: any[] = [],
      ) => {
        const summary = await runWithRateLimitBackoff(
          async attemptNumber => {
            const locations =
              attemptNumber === 1 ? sourceLocations : await resolveSourcesToProcess(sourceRegistry, 'resume');
            const urls = toJobSourceURLs(locations).filter(x => matchHost(x.host));
            if (urls.length === 0) {
              if (attemptNumber > 1) {
                console.log(`>>> [${label}] No pending URL(s) left to resume on retry #${attemptNumber - 1}.`);
              }
              return {};
            }

            const totalSourceCount = new Set(urls.map(x => getSourceKey(x.url_with_page_index))).size;
            console.log(
              `>>> Starting ${label} crawler${attemptNumber > 1 ? ` (retry #${attemptNumber - 1}, resume mode)` : ''} ` +
                `from URL(${urls.length} URL(s), ${totalSourceCount} job source(s))...`,
            );
            const { router, flushPending, takeStopReason } = createHandler(urls);
            Configuration.getGlobalConfig().set('purgeOnStart', true);
            const crawler = new PuppeteerCrawler(makeCrawlerOptions(router, extraPreNavigationHooks));
            await crawler.run(urls.map(x => x.url_with_page_index));
            await flushPending();
            return { stopReason: takeStopReason() };
          },
          { ...backoff, label, logger: { info: console.log, warning: console.warn, error: console.error } },
        );

        if (!summary.succeeded) {
          throw new Error(
            `${label} crawler gave up after ${summary.retries} retries ` +
              `(CRAWL_BACKOFF_MAX_RETRIES=${backoff.maxRetries}): ${summary.lastStopReason?.message}`,
          );
        }
        return summary;
      };

      const initialJobSourceURLs = toJobSourceURLs(sourceLocations);

      if (initialJobSourceURLs.some(x => is104Host(x.host))) {
        await runSiteCrawlerWithBackoff('104', is104Host, urls =>
          createHandler104(keywords, new Set(urls.map(x => getSourceKey(x.url_with_page_index))).size, knownPageFloors),
        );
      }

      if (initialJobSourceURLs.some(x => isCakeHost(x.host))) {
        await runSiteCrawlerWithBackoff(
          'Cake',
          isCakeHost,
          urls =>
            createHandlerCake(
              keywords,
              new Set(urls.map(x => getSourceKey(x.url_with_page_index))).size,
              knownPageFloors,
              useUiFilters,
            ),
          [createCakeHomepageWarmupHook()],
        );
      }
      break;
    }

    case 'crawl-from-file': {
      if (!crawlFromFileArg!.includes('=')) {
        throw new Error(
          'crawl-from-file mode requires an explicit file path: ' +
            'use crawl-from-file=<path> (Requirement 1.1 — the operator ' +
            'must explicitly specify what to ingest, there is no default).',
        );
      }
      const filePath = crawlFromFileArg!.slice(crawlFromFileArg!.indexOf('=') + 1);

      const force = cliArgs.includes('force');
      console.log(`>>> Ingesting handoff file: ${filePath}${force ? ' (force mode)' : ''}`);
      const summary = await ingestHandoffFile(filePath, keywords, force);
      console.log(
        `>>> Handoff ingestion complete: processed ${summary.processedPages} page(s), ` +
          `skipped ${summary.skippedAlreadyCompletedPages} already-completed page(s)` +
          (summary.rejectedItemIssues.length > 0
            ? `, ${summary.rejectedItemIssues.length} rejected item issue(s)`
            : ''),
      );
      break;
    }
  }
}

main().catch(error => {
  console.error('Crawler failed:', error);
  process.exit(1);
});
