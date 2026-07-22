import { Configuration, PuppeteerCrawler } from 'crawlee';
import * as dotenv from 'dotenv';
import * as path from 'path';

import {
  createStealthLaunchContext,
  createStealthPreNavigationHook,
  getSourceKey,
  setPageIndex,
} from '@codeshore/crawler-core';
import {
  DEFAULT_MODEL_FALLBACK,
  DEFAULT_MODEL_SETTING_KEY,
  OpenRouterLlmClient,
} from '@codeshore/ai-client';
import {
  AiLlmSettingService,
  JobService,
  MvTechService,
  generateJobKeywordsFromLines,
} from '@codeshore/data-utils';
import { parseSalary } from '@codeshore/shared-utils';
import {
  createStalenessSyncEngine,
  resolveSourcesToProcess,
} from '@codeshore/sync-core';

import { createHandler as createHandler104 } from './104/handler';
import { isTheHost as is104Host } from './104/utils';
import { createHandler as createHandlerCake } from './cake/handler';
import { isTheHost as isCakeHost } from './cake/utils';
import { sourceRegistry } from './persistence';
import { createJobStalenessSyncConfig } from './staleness-sync';

// `__dirname` 不可靠:esbuild production build 會把 main.js 攤平到
// dist/apps/crawler 根目錄(不保留 src/ 巢狀結構),導致相對路徑跑掉。
// Nx target 一律從 workspace root 執行,故改以 process.cwd() 為基準。
const envPath = path.resolve(
  process.cwd(),
  'apps/crawler/.env',
);

dotenv.config({
  path: envPath,
});

export function splitTopLevel(
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

interface StealthCrawlConfig {
  launchContext: ReturnType<typeof createStealthLaunchContext>;
  preNavigationHook: ReturnType<
    typeof createStealthPreNavigationHook
  >;
}

export type Mode =
  | 're-crawl'
  | 'job-salary'
  | 'job-keyword'
  | 'crawl';

export interface ResolvedCliArgs {
  mode: Mode;
  reCrawlJobsArg: string | undefined;
  crawlArg: string | undefined;
}

/**
 * 依 CLI 參數決定執行模式與各模式所需的原始參數字串,純函式、不含副作用,
 * 對應 `main()` 原本內聯的 `args.find(...)` + if/else 判斷邏輯。
 */
export function resolveCliArgs(args: string[]): ResolvedCliArgs {
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

  let mode: Mode;
  if (reCrawlJobsArg) mode = 're-crawl';
  else if (resetMinMaxSalaryArg) mode = 'job-salary';
  else if (resetJobKeywordArg) mode = 'job-keyword';
  else mode = 'crawl';

  return { mode, reCrawlJobsArg, crawlArg };
}

async function main() {
  const stealthConfig: StealthCrawlConfig = {
    launchContext: createStealthLaunchContext({
      executablePath:
        process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
    }),
    preNavigationHook: createStealthPreNavigationHook(),
  };

  const { mode, reCrawlJobsArg, crawlArg } = resolveCliArgs(
    process.argv.slice(2),
  );

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
      const stalenessConfig = createJobStalenessSyncConfig(
        keywords,
        whereExpr ? parseWhereExpr(whereExpr) : undefined,
      );
      await createStalenessSyncEngine(stalenessConfig).run(
        stealthConfig.launchContext,
        stealthConfig.preNavigationHook,
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
      const model =
        (await new AiLlmSettingService().getValue(
          DEFAULT_MODEL_SETTING_KEY,
        )) ?? DEFAULT_MODEL_FALLBACK;
      const llmClient = new OpenRouterLlmClient(model);
      await generateJobKeywordsFromLines({ llmClient });
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
      } else {
        console.log('>>> Resume mode');
      }

      const makeCrawlerOptions = (requestHandler: any) => ({
        launchContext: stealthConfig.launchContext as any,
        browserPoolOptions: {
          useFingerprints: false,
        },
        preNavigationHooks: [
          stealthConfig.preNavigationHook as any,
        ],
        requestHandler,
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 120,
      });

      const sourceLocations = await resolveSourcesToProcess(
        sourceRegistry,
        isFresh ? 'fresh' : 'resume',
      );

      if (isFresh) {
        console.log('>>> Fresh mode: starting from page=1');
      } else if (sourceLocations.length > 0) {
        console.log(
          `>>> Resume mode: ${sourceLocations.length} pending URL(s)`,
        );
      } else {
        console.log(
          '>>> Resume mode: no pending URL(s) to resume, nothing to do',
        );
      }

      const jobSourceURLs = sourceLocations.map(x => ({
        host: new URL(x.url).host,
        url_with_page_index: setPageIndex(
          x.url,
          x.pageIndex,
        ),
      }));

      const jobSourceURLs104 = jobSourceURLs.filter(x =>
        is104Host(x.host),
      );

      const jobSourceURLsCake = jobSourceURLs.filter(x =>
        isCakeHost(x.host),
      );

      if (jobSourceURLs104.length > 0) {
        const totalSourceCount104 = new Set(
          jobSourceURLs104.map(x =>
            getSourceKey(x.url_with_page_index),
          ),
        ).size;
        console.log(
          `>>> Starting 104 crawler from URL(${jobSourceURLs104.length} URL(s), ${totalSourceCount104} job source(s))...`,
        );
        const {
          router: requestHandler104,
          flushPending: flushPending104,
        } = createHandler104(keywords, totalSourceCount104);
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
        await flushPending104();
      }

      if (jobSourceURLsCake.length > 0) {
        const totalSourceCountCake = new Set(
          jobSourceURLsCake.map(x =>
            getSourceKey(x.url_with_page_index),
          ),
        ).size;
        console.log(
          `>>> Starting Cake crawler from URL(${jobSourceURLsCake.length} URL(s), ${totalSourceCountCake} job source(s))...`,
        );
        const {
          router: requestHandlerCake,
          flushPending: flushPendingCake,
        } = createHandlerCake(keywords, totalSourceCountCake);
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
        await flushPendingCake();
      }
      break;
    }
  }
}

main().catch(error => {
  console.error('Crawler failed:', error);
  process.exit(1);
});
