import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `main.ts` self-invokes `main().catch(...)` at module load time (it's a CLI
// entrypoint, not a library module), and transitively imports
// `@codeshore/sync-core` (whose barrel unconditionally re-exports
// `createStalenessSyncEngine`, which imports real `crawlee`/`puppeteer` — the
// ~9s one-time cost documented in tasks.md's Task 5.2/5.3 Implementation
// Note). This spec focuses on two natural, already-exported testable seams
// that drive the observable behavior this task changes, without needing to
// actually execute `main()`'s side effects:
//
// 1. `resolveCliArgs` — pure function extracted from `main()`'s inline
//    `args.find(...)` + if/else mode-resolution logic (unchanged logic, only
//    hoisted out and exported so it's directly testable).
// 2. `parseWhereExpr`/`splitTopLevel` — already-pure helpers now exported,
//    proving the `re-crawl=<whereExpr>` CLI argument parsing that feeds
//    `createJobStalenessSyncConfig`'s `where` parameter is unchanged.
//
// The actual wiring inside `main()`'s `crawl`/`re-crawl` cases (calling
// `resolveSourcesToProcess`/`createStalenessSyncEngine`) is covered by a
// second describe block below that mocks every dependency `main.ts` touches
// and drives `main()` itself through dynamic import per CLI-arg scenario,
// resetting modules between scenarios so each test observes a fresh
// dispatch. `@codeshore/sync-core` is mocked directly (not `importOriginal`),
// so the real `crawlee`/`puppeteer` chain is never loaded here — verified
// empirically (see MODULE_LOAD_TIMING_CHECK in the status report): this file
// runs fast with no `beforeAll` warm-up needed because the heavy transitive
// dependency is never actually imported.

import {
  CRAWL_BACKOFF_DEFAULTS,
  parseWhereExpr,
  resolveCliArgs,
  resolveCrawlBackoffOptions,
  splitTopLevel,
} from './main';

describe('resolveCrawlBackoffOptions (env → linear backoff schedule)', () => {
  const MINUTE = 60_000;

  it('defaults to 5m first wait, +5m per retry, no cap, unlimited retries', () => {
    const options = resolveCrawlBackoffOptions({});
    expect(CRAWL_BACKOFF_DEFAULTS).toEqual({
      initialMinutes: 5,
      incrementMinutes: 5,
    });
    expect(options.initialDelayMs).toBe(5 * MINUTE);
    expect(options.incrementMs).toBe(5 * MINUTE);
    expect(options.maxDelayMs).toBeUndefined();
    expect(options.maxRetries).toBeUndefined();
    expect([1, 2, 3].map(options.delayForRetry)).toEqual([
      5 * MINUTE,
      10 * MINUTE,
      15 * MINUTE,
    ]);
  });

  it('reads initial/increment/cap/max-retries from env (minutes, decimals allowed)', () => {
    const options = resolveCrawlBackoffOptions({
      CRAWL_BACKOFF_INITIAL_MINUTES: '1.5',
      CRAWL_BACKOFF_INCREMENT_MINUTES: '2',
      CRAWL_BACKOFF_MAX_DELAY_MINUTES: '4',
      CRAWL_BACKOFF_MAX_RETRIES: '3',
    });
    expect(options.maxRetries).toBe(3);
    expect([1, 2, 3].map(options.delayForRetry)).toEqual([
      1.5 * MINUTE,
      3.5 * MINUTE,
      4 * MINUTE,
    ]);
  });

  it('treats blank env values as unset', () => {
    const options = resolveCrawlBackoffOptions({
      CRAWL_BACKOFF_INITIAL_MINUTES: '',
      CRAWL_BACKOFF_MAX_RETRIES: '  ',
    });
    expect(options.initialDelayMs).toBe(5 * MINUTE);
    expect(options.maxRetries).toBeUndefined();
  });

  it('rejects negative, non-numeric, or non-integer-retry values with a clear error', () => {
    expect(() =>
      resolveCrawlBackoffOptions({ CRAWL_BACKOFF_INITIAL_MINUTES: '-1' }),
    ).toThrow('CRAWL_BACKOFF_INITIAL_MINUTES');
    expect(() =>
      resolveCrawlBackoffOptions({ CRAWL_BACKOFF_INCREMENT_MINUTES: 'abc' }),
    ).toThrow('CRAWL_BACKOFF_INCREMENT_MINUTES');
    expect(() =>
      resolveCrawlBackoffOptions({ CRAWL_BACKOFF_MAX_RETRIES: '1.5' }),
    ).toThrow('CRAWL_BACKOFF_MAX_RETRIES');
  });
});

describe('resolveCliArgs (pure mode-dispatch logic)', () => {
  it('resolves to "re-crawl" when args include the bare "re-crawl" flag', () => {
    const result = resolveCliArgs(['re-crawl']);
    expect(result.mode).toBe('re-crawl');
    expect(result.reCrawlJobsArg).toBe('re-crawl');
  });

  it('resolves to "re-crawl" and preserves the raw arg when given "re-crawl=<whereExpr>"', () => {
    const result = resolveCliArgs(['re-crawl=updated_at.lt.2026-01-01']);
    expect(result.mode).toBe('re-crawl');
    expect(result.reCrawlJobsArg).toBe(
      're-crawl=updated_at.lt.2026-01-01',
    );
  });

  it('resolves to "export-liked-jobs" when args include the bare "export-liked-jobs" flag', () => {
    const result = resolveCliArgs([
      'export-liked-jobs',
      'user=user-1',
      'out=/tmp/liked.csv',
    ]);
    expect(result.mode).toBe('export-liked-jobs');
    expect(result.exportLikedJobsArg).toBe('export-liked-jobs');
  });

  it('resolves to "job-salary" when args include a "job-salary" flag', () => {
    const result = resolveCliArgs(['job-salary']);
    expect(result.mode).toBe('job-salary');
  });

  it('resolves to "job-keyword" when args include a "job-keyword" flag', () => {
    const result = resolveCliArgs(['job-keyword']);
    expect(result.mode).toBe('job-keyword');
  });

  it('resolves to "crawl" and preserves the raw arg when given "crawl=fresh"', () => {
    const result = resolveCliArgs(['crawl=fresh']);
    expect(result.mode).toBe('crawl');
    expect(result.crawlArg).toBe('crawl=fresh');
  });

  it('defaults to "crawl" when no recognized flag is present', () => {
    const result = resolveCliArgs([]);
    expect(result.mode).toBe('crawl');
    expect(result.reCrawlJobsArg).toBeUndefined();
    expect(result.crawlArg).toBeUndefined();
  });

  it('prioritizes "re-crawl" over other flags when multiple are present, matching the original if/else-if precedence', () => {
    const result = resolveCliArgs(['re-crawl', 'job-salary', 'crawl']);
    expect(result.mode).toBe('re-crawl');
  });

  it('resolves to "crawl-from-file" and preserves the raw arg when given "crawl-from-file=<path>"', () => {
    const result = resolveCliArgs(['crawl-from-file=/tmp/x.json']);
    expect(result.mode).toBe('crawl-from-file');
    expect(result.crawlFromFileArg).toBe('crawl-from-file=/tmp/x.json');
  });

  it('resolves to "re-crawl-from-file" and preserves the raw arg when given "re-crawl-from-file=<path>"', () => {
    const result = resolveCliArgs(['re-crawl-from-file=/tmp/ids.csv']);
    expect(result.mode).toBe('re-crawl-from-file');
    expect(result.reCrawlFromFileArg).toBe(
      're-crawl-from-file=/tmp/ids.csv',
    );
  });

  it('resolves to "re-crawl-from-file" and preserves the bare raw arg when given "re-crawl-from-file" with no path', () => {
    const result = resolveCliArgs(['re-crawl-from-file']);
    expect(result.mode).toBe('re-crawl-from-file');
    expect(result.reCrawlFromFileArg).toBe('re-crawl-from-file');
  });

  it('does not confuse "re-crawl-from-file=<path>" with bare "re-crawl" mode', () => {
    const result = resolveCliArgs(['re-crawl-from-file=/tmp/ids.csv']);
    expect(result.reCrawlJobsArg).toBeUndefined();
  });

  it('resolves to "crawl-from-file" and preserves the bare raw arg when given "crawl-from-file" with no path', () => {
    const result = resolveCliArgs(['crawl-from-file']);
    expect(result.mode).toBe('crawl-from-file');
    expect(result.crawlFromFileArg).toBe('crawl-from-file');
  });
});

describe('parseWhereExpr / splitTopLevel (re-crawl=<whereExpr> parsing, unchanged by this task)', () => {
  it('parses a single field filter into a nested where clause', () => {
    expect(parseWhereExpr('updated_at.lt.2026-01-01')).toEqual({
      updated_at: { lt: '2026-01-01' },
    });
  });

  it('parses multiple comma-separated field filters', () => {
    expect(parseWhereExpr('id.eq.job-1,source.eq.104')).toEqual({
      id: { eq: 'job-1' },
      source: { eq: '104' },
    });
  });

  it('parses an OR group into a "$or" key', () => {
    expect(parseWhereExpr('(source.eq.104|source.eq.cake)')).toEqual({
      $or: 'source.eq.104,source.eq.cake',
    });
  });

  it('splitTopLevel does not split on separators nested inside parentheses', () => {
    expect(splitTopLevel('id.in.(1,2,3),source.eq.104', ',')).toEqual([
      'id.in.(1,2,3)',
      'source.eq.104',
    ]);
  });
});

// `@codeshore/data-utils` builds a real Supabase client under the hood; mock
// it the same way `persistence.spec.ts`/`staleness-sync.spec.ts`/
// `104/handler.spec.ts` do so importing `main.ts` never touches Supabase or
// reads real env config.
const {
  mvTechFetchAllMock,
  jobServiceFetchAllMock,
  jobServiceUpdateMultipleMock,
  aiLlmSettingGetValueMock,
  generateJobKeywordsFromLinesMock,
} = vi.hoisted(() => ({
  mvTechFetchAllMock: vi.fn(async () => ({
    result: [] as { keywords: string[] }[],
    count: 0,
    searchParams: '',
  })),
  jobServiceFetchAllMock: vi.fn(async () => ({
    result: [] as unknown[],
    count: 0,
    searchParams: '',
  })),
  jobServiceUpdateMultipleMock: vi.fn(async () => undefined),
  aiLlmSettingGetValueMock: vi.fn(async () => null as string | null),
  generateJobKeywordsFromLinesMock: vi.fn(async () => undefined),
}));

vi.mock('@codeshore/data-utils', () => ({
  MvTechService: vi.fn(() => ({ fetchAll: mvTechFetchAllMock })),
  JobService: vi.fn(() => ({
    fetchAll: jobServiceFetchAllMock,
    updateMultiple: jobServiceUpdateMultipleMock,
  })),
  AiLlmSettingService: vi.fn(() => ({
    getValue: aiLlmSettingGetValueMock,
  })),
  generateJobKeywordsFromLines: generateJobKeywordsFromLinesMock,
}));

// `@codeshore/ai-client` constructs a real OpenRouter-backed client; mock it
// so the `job-keyword` mode test can assert `main.ts` constructs it with the
// resolved model id without making real HTTP calls.
const { openRouterLlmClientMock } = vi.hoisted(() => ({
  openRouterLlmClientMock: vi.fn(function (this: unknown, _model: string) {
    return { marker: 'fake-llm-client' };
  }),
}));

vi.mock('@codeshore/ai-client', () => ({
  OpenRouterLlmClient: openRouterLlmClientMock,
  DEFAULT_MODEL_SETTING_KEY: 'default_model',
  DEFAULT_MODEL_FALLBACK: 'meta-llama/llama-3.3-70b-instruct:free',
}));

// `@codeshore/crawler-core` constructs a real stealth puppeteer launch
// context; mock it so `main.ts`'s module-level `createStealthLaunchContext`/
// `createStealthPreNavigationHook` calls stay cheap and inert.
vi.mock('@codeshore/crawler-core', async importOriginal => {
  // The rate-limit backoff runner/schedule are pure (no browser, no I/O);
  // keep the real implementations so `crawl` mode's retry wiring is exercised
  // for real, with the wait driven to 0 via env in the relevant tests.
  const actual = await importOriginal<typeof import('@codeshore/crawler-core')>();
  return {
    createLinearBackoffSchedule: actual.createLinearBackoffSchedule,
    runWithRateLimitBackoff: actual.runWithRateLimitBackoff,
    createStealthLaunchContext: vi.fn(() => ({ launchContext: 'fake' })),
    createStealthPreNavigationHook: vi.fn(() => ({ hook: 'fake' })),
    setPageIndex: (url: string, pageIndex: number) => `${url}?page=${pageIndex}`,
    getSourceKey: (url: string) => {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('page');
      return urlObj.toString();
    },
  };
});

// This is the seam under test: prove `main.ts`'s `crawl`/`re-crawl` modes
// call the new `@codeshore/sync-core` entry points with the right arguments,
// instead of the old manual `JobSourceURLService` queries / `reCrawlJobs`
// body (both fully removed by this task). Mocked directly (no
// `importOriginal`) so the real `crawlee`/`puppeteer` chain behind
// `createStalenessSyncEngine` is never loaded.
const { resolveSourcesToProcessMock, createStalenessSyncEngineMock, stalenessRunMock } =
  vi.hoisted(() => ({
    resolveSourcesToProcessMock: vi.fn(async () => [] as { url: string; pageIndex: number }[]),
    createStalenessSyncEngineMock: vi.fn(),
    stalenessRunMock: vi.fn(async () => undefined),
  }));

vi.mock('@codeshore/sync-core', () => ({
  resolveSourcesToProcess: resolveSourcesToProcessMock,
  createStalenessSyncEngine: createStalenessSyncEngineMock,
}));

// `./persistence` constructs real Supabase-backed services at module scope;
// stub `sourceRegistry` to a plain object identity so we can assert it's the
// exact reference forwarded into `resolveSourcesToProcess`.
const { fakeSourceRegistry, fetchMaxKnownPageIndexMock } = vi.hoisted(() => {
  const fetchMaxKnownPageIndexMockInner = vi
    .fn()
    .mockResolvedValue(new Map<string, number>());
  return {
    fakeSourceRegistry: {
      marker: 'fake-source-registry',
      fetchMaxKnownPageIndex: fetchMaxKnownPageIndexMockInner,
    },
    fetchMaxKnownPageIndexMock: fetchMaxKnownPageIndexMockInner,
  };
});
vi.mock('./persistence', () => ({
  sourceRegistry: fakeSourceRegistry,
}));

// `./staleness-sync` pulls in `@codeshore/data-utils` transitively; stub the
// factory so we can assert `main.ts` passes it the right `allGroupKeywords`/
// `where` and forwards its return value into `createStalenessSyncEngine`.
const { fakeStalenessConfig, createJobStalenessSyncConfigMock } = vi.hoisted(
  () => {
    const config = { marker: 'fake-staleness-config' };
    return {
      fakeStalenessConfig: config,
      createJobStalenessSyncConfigMock: vi.fn(() => config),
    };
  },
);
vi.mock('./staleness-sync', () => ({
  createJobStalenessSyncConfig: createJobStalenessSyncConfigMock,
}));

// `./re-crawl-from-file` reads real files via `fs`; stub it so the
// `re-crawl-from-file` mode's CLI wiring can be asserted (path passed
// through, resulting job ids forwarded into `createJobStalenessSyncConfig`
// via `buildJobIdWhere`) without touching the filesystem. `buildJobIdWhere`
// is the real implementation (pure, no I/O) so the exact `where` shape
// forwarded to `createJobStalenessSyncConfig` is verified end-to-end.
const { readJobIdsFromCsvFileMock } = vi.hoisted(() => ({
  readJobIdsFromCsvFileMock: vi.fn(async () => [] as string[]),
}));
vi.mock('./re-crawl-from-file', async importOriginal => {
  const actual =
    await importOriginal<typeof import('./re-crawl-from-file')>();
  return {
    ...actual,
    readJobIdsFromCsvFile: readJobIdsFromCsvFileMock,
  };
});

// `./export-liked-jobs` builds a real `JobPreferenceService` (Supabase) and
// writes real files; stub it so the `export-liked-jobs` mode's CLI wiring
// (userId/preference/outputPath forwarding) can be asserted without touching
// Supabase or the filesystem.
const { fetchJobIdsByUserPreferenceMock, writeJobIdsCsvMock } = vi.hoisted(
  () => ({
    fetchJobIdsByUserPreferenceMock: vi.fn(
      async () => [] as string[],
    ),
    writeJobIdsCsvMock: vi.fn(async () => undefined),
  }),
);
vi.mock('./export-liked-jobs', () => ({
  fetchJobIdsByUserPreference: fetchJobIdsByUserPreferenceMock,
  writeJobIdsCsv: writeJobIdsCsvMock,
}));

// `./104/handler` and `./cake/handler` are DOM-extraction call paths this
// task must NOT touch. Stub them minimally so `crawl` mode dispatch can be
// exercised without invoking real `PuppeteerCrawler`/`crawlee`.
const {
  flushPending104Mock,
  flushPendingCakeMock,
  takeStopReason104Mock,
  takeStopReasonCakeMock,
} = vi.hoisted(() => ({
  flushPending104Mock: vi.fn(async () => undefined),
  flushPendingCakeMock: vi.fn(async () => undefined),
  takeStopReason104Mock: vi.fn((): unknown => undefined),
  takeStopReasonCakeMock: vi.fn((): unknown => undefined),
}));
vi.mock('./104/handler', () => ({
  createHandler: vi.fn(() => ({
    router: {},
    flushPending: flushPending104Mock,
    takeStopReason: takeStopReason104Mock,
  })),
}));
vi.mock('./cake/handler', () => ({
  createHandler: vi.fn(() => ({
    router: {},
    flushPending: flushPendingCakeMock,
    takeStopReason: takeStopReasonCakeMock,
  })),
}));

// `crawlee`'s `PuppeteerCrawler`/`Configuration` are heavy; stub them so
// `crawl` mode's untouched 104/Cake dispatch path can run inertly.
vi.mock('crawlee', () => ({
  Configuration: {
    getGlobalConfig: vi.fn(() => ({ set: vi.fn() })),
  },
  PuppeteerCrawler: vi.fn(() => ({ run: vi.fn(async () => undefined) })),
}));

vi.mock('dotenv', () => ({ config: vi.fn() }));

// `./handoff/ingest-handoff-file` is task 3.1's already-implemented
// orchestrator; mock it so this task's CLI wiring tests assert *how* it's
// called (path + shared `keywords`) without exercising its real file I/O,
// crawler construction, or Supabase-backed `sourceRegistry` calls.
const { ingestHandoffFileMock } = vi.hoisted(() => ({
  ingestHandoffFileMock: vi.fn(async () => ({
    processedPages: 0,
    skippedAlreadyCompletedPages: 0,
    rejectedItemIssues: [] as { pageIndex: number; itemIndex?: number; reason: string }[],
  })),
}));
vi.mock('./handoff/ingest-handoff-file', () => ({
  ingestHandoffFile: ingestHandoffFileMock,
}));

describe('main() dispatch wiring (post sync-core migration)', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mvTechFetchAllMock.mockResolvedValue({
      result: [{ keywords: ['Node.js'] }],
      count: 1,
      searchParams: '',
    });
    resolveSourcesToProcessMock.mockResolvedValue([]);
    createStalenessSyncEngineMock.mockReturnValue({ run: stalenessRunMock });
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  async function runMainWithArgv(argv: string[]): Promise<void> {
    process.argv = ['node', 'main.js', ...argv];
    // `vi.resetModules()` (called in `beforeEach`) clears the module
    // registry so this dynamic import re-evaluates `main.ts` from scratch,
    // re-running its top-level `main().catch(...)` self-invocation against
    // the current `process.argv`.
    await import('./main');
    // `main()` is invoked fire-and-forget (`main().catch(...)`) at import
    // time; flush pending dynamic-import machinery and one more microtask
    // turn so its internal awaits resolve before assertions run.
    await vi.dynamicImportSettled();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  it('crawl mode (resume) calls resolveSourcesToProcess with the real sourceRegistry and mode "resume"', async () => {
    await runMainWithArgv(['crawl']);

    expect(resolveSourcesToProcessMock).toHaveBeenCalledWith(
      fakeSourceRegistry,
      'resume',
    );
  });

  it('crawl=fresh mode calls resolveSourcesToProcess with mode "fresh"', async () => {
    await runMainWithArgv(['crawl=fresh']);

    expect(resolveSourcesToProcessMock).toHaveBeenCalledWith(
      fakeSourceRegistry,
      'fresh',
    );
  });

  it('crawl mode dispatches resolved 104-host source locations to the untouched 104 handler', async () => {
    resolveSourcesToProcessMock.mockResolvedValueOnce([
      { url: 'https://www.104.com.tw/jobs/search/1', pageIndex: 1 },
    ]);

    await runMainWithArgv(['crawl']);

    const handler104 = await import('./104/handler');
    expect(handler104.createHandler).toHaveBeenCalledWith(
      ['Node.js'],
      1,
      undefined,
    );
    expect(flushPending104Mock).toHaveBeenCalledTimes(1);
  });

  it('crawl mode dispatches resolved Cake-host source locations to the untouched Cake handler', async () => {
    resolveSourcesToProcessMock.mockResolvedValueOnce([
      { url: 'https://www.cake.me/companies/x/jobs', pageIndex: 1 },
    ]);

    await runMainWithArgv(['crawl']);

    const handlerCake = await import('./cake/handler');
    expect(handlerCake.createHandler).toHaveBeenCalledWith(
      ['Node.js'],
      1,
      undefined,
    );
    expect(flushPendingCakeMock).toHaveBeenCalledTimes(1);
  });

  it('crawl=fresh mode fetches known page floors from the real sourceRegistry before resolveSourcesToProcess clears tracked state, and forwards the result into the 104 handler', async () => {
    const knownFloors = new Map<string, number>([
      ['https://www.104.com.tw/jobs/search/1', 7],
    ]);
    fetchMaxKnownPageIndexMock.mockResolvedValueOnce(knownFloors);
    resolveSourcesToProcessMock.mockResolvedValueOnce([
      { url: 'https://www.104.com.tw/jobs/search/1', pageIndex: 1 },
    ]);

    await runMainWithArgv(['crawl=fresh']);

    expect(fetchMaxKnownPageIndexMock).toHaveBeenCalledTimes(1);
    const handler104 = await import('./104/handler');
    expect(handler104.createHandler).toHaveBeenCalledWith(
      ['Node.js'],
      1,
      knownFloors,
    );
  });

  it('crawl mode (resume) never calls fetchMaxKnownPageIndex — resume never clears tracked state, so there is nothing to protect against', async () => {
    await runMainWithArgv(['crawl']);

    expect(fetchMaxKnownPageIndexMock).not.toHaveBeenCalled();
  });

  it('crawl mode retries a rate-limited 104 run in resume mode with a fresh handler + crawler, and continues to Cake once 104 completes', async () => {
    // Drive the backoff wait to 0 so the retry loop runs instantly.
    process.env['CRAWL_BACKOFF_INITIAL_MINUTES'] = '0';
    process.env['CRAWL_BACKOFF_INCREMENT_MINUTES'] = '0';
    try {
      const rateLimited = {
        kind: 'rate-limited',
        url: 'https://www.104.com.tw/jobs/search/1?page=3',
        status: 429,
        message:
          'Rate limited (HTTP 429) on https://www.104.com.tw/jobs/search/1?page=3',
      };
      // Initial resolve (attempt 1) → both hosts; retry resolve → only the
      // pending 104 page 3 remains.
      resolveSourcesToProcessMock
        .mockResolvedValueOnce([
          { url: 'https://www.104.com.tw/jobs/search/1', pageIndex: 1 },
          { url: 'https://www.cake.me/companies/x/jobs', pageIndex: 1 },
        ])
        .mockResolvedValueOnce([
          { url: 'https://www.104.com.tw/jobs/search/1', pageIndex: 3 },
          { url: 'https://www.cake.me/companies/x/jobs', pageIndex: 1 },
        ]);
      takeStopReason104Mock
        .mockReturnValueOnce(rateLimited)
        .mockReturnValueOnce(undefined);

      await runMainWithArgv(['crawl']);
      // Let the (zero-length) backoff sleep and the retry attempt settle.
      await new Promise(resolve => setTimeout(resolve, 20));

      const { PuppeteerCrawler } = await import('crawlee');
      const handler104 = await import('./104/handler');
      const handlerCake = await import('./cake/handler');

      // 104: attempt 1 + retry 1 → two fresh handlers and two crawlers.
      expect(handler104.createHandler).toHaveBeenCalledTimes(2);
      expect(flushPending104Mock).toHaveBeenCalledTimes(2);
      expect(takeStopReason104Mock).toHaveBeenCalledTimes(2);
      // The retry re-queries pending sources in resume mode.
      expect(resolveSourcesToProcessMock).toHaveBeenCalledTimes(2);
      expect(resolveSourcesToProcessMock).toHaveBeenNthCalledWith(
        2,
        fakeSourceRegistry,
        'resume',
      );
      const crawlerMock = PuppeteerCrawler as unknown as ReturnType<typeof vi.fn>;
      const runs = crawlerMock.mock.results.map(
        r => (r.value as { run: ReturnType<typeof vi.fn> }).run,
      );
      expect(runs[1]).toHaveBeenCalledWith([
        'https://www.104.com.tw/jobs/search/1?page=3',
      ]);
      // Cake still runs afterwards, exactly once.
      expect(handlerCake.createHandler).toHaveBeenCalledTimes(1);
      expect(flushPendingCakeMock).toHaveBeenCalledTimes(1);
      expect(crawlerMock).toHaveBeenCalledTimes(3);
    } finally {
      delete process.env['CRAWL_BACKOFF_INITIAL_MINUTES'];
      delete process.env['CRAWL_BACKOFF_INCREMENT_MINUTES'];
    }
  });

  it('re-crawl mode (no where override) constructs the Job staleness config with keywords and undefined where, then runs the engine with the stealth launch context/hook', async () => {
    await runMainWithArgv(['re-crawl']);

    expect(createJobStalenessSyncConfigMock).toHaveBeenCalledWith(
      ['Node.js'],
      undefined,
    );
    expect(createStalenessSyncEngineMock).toHaveBeenCalledWith(
      fakeStalenessConfig,
    );
    expect(stalenessRunMock).toHaveBeenCalledWith(
      { launchContext: 'fake' },
      { hook: 'fake' },
    );
  });

  it('re-crawl=<whereExpr> mode parses the where expression and forwards it to createJobStalenessSyncConfig', async () => {
    await runMainWithArgv(['re-crawl=updated_at.lt.2026-01-01']);

    expect(createJobStalenessSyncConfigMock).toHaveBeenCalledWith(
      ['Node.js'],
      { updated_at: { lt: '2026-01-01' } },
    );
  });

  it('re-crawl-from-file=<path> mode reads job ids from the CSV and forwards an id-in where clause to createJobStalenessSyncConfig, then runs the engine', async () => {
    readJobIdsFromCsvFileMock.mockResolvedValueOnce(['job-1', 'job-2']);

    await runMainWithArgv(['re-crawl-from-file=/tmp/ids.csv']);

    expect(readJobIdsFromCsvFileMock).toHaveBeenCalledWith(
      '/tmp/ids.csv',
    );
    expect(createJobStalenessSyncConfigMock).toHaveBeenCalledWith(
      ['Node.js'],
      { id: { in: '(job-1,job-2)' } },
    );
    expect(createStalenessSyncEngineMock).toHaveBeenCalledWith(
      fakeStalenessConfig,
    );
    expect(stalenessRunMock).toHaveBeenCalledWith(
      { launchContext: 'fake' },
      { hook: 'fake' },
    );
    expect(resolveSourcesToProcessMock).not.toHaveBeenCalled();
  });

  it('re-crawl-from-file mode (no path given) rejects with a clear, descriptive error before reading any file, and main() reports it via the top-level catch handler', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await runMainWithArgv(['re-crawl-from-file']);

    expect(readJobIdsFromCsvFileMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Crawler failed:',
      expect.objectContaining({
        message: expect.stringContaining('re-crawl-from-file'),
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('re-crawl-from-file mode propagates a descriptive error when the CSV has no job ids, without touching sync-core', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    readJobIdsFromCsvFileMock.mockRejectedValueOnce(
      new Error('Job id CSV file contains no job ids: /tmp/empty.csv'),
    );

    await runMainWithArgv(['re-crawl-from-file=/tmp/empty.csv']);

    expect(createJobStalenessSyncConfigMock).not.toHaveBeenCalled();
    expect(createStalenessSyncEngineMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Crawler failed:',
      expect.objectContaining({
        message: 'Job id CSV file contains no job ids: /tmp/empty.csv',
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('export-liked-jobs mode fetches liked job ids for the given user and writes them to the given path, defaulting preference to "like"', async () => {
    fetchJobIdsByUserPreferenceMock.mockResolvedValueOnce([
      'job-1',
      'job-2',
    ]);

    await runMainWithArgv([
      'export-liked-jobs',
      'user=user-1',
      'out=/tmp/liked.csv',
    ]);

    expect(fetchJobIdsByUserPreferenceMock).toHaveBeenCalledWith(
      'user-1',
      'like',
    );
    expect(writeJobIdsCsvMock).toHaveBeenCalledWith(
      ['job-1', 'job-2'],
      '/tmp/liked.csv',
    );
    expect(createStalenessSyncEngineMock).not.toHaveBeenCalled();
    expect(resolveSourcesToProcessMock).not.toHaveBeenCalled();
  });

  it('export-liked-jobs mode forwards an explicit "dislike" preference', async () => {
    await runMainWithArgv([
      'export-liked-jobs',
      'user=user-1',
      'out=/tmp/disliked.csv',
      'preference=dislike',
    ]);

    expect(fetchJobIdsByUserPreferenceMock).toHaveBeenCalledWith(
      'user-1',
      'dislike',
    );
  });

  it('export-liked-jobs mode rejects with a clear error when user= or out= is missing, without fetching or writing anything', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await runMainWithArgv(['export-liked-jobs', 'user=user-1']);

    expect(fetchJobIdsByUserPreferenceMock).not.toHaveBeenCalled();
    expect(writeJobIdsCsvMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Crawler failed:',
      expect.objectContaining({
        message: expect.stringContaining('export-liked-jobs'),
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('export-liked-jobs mode rejects an invalid preference value before fetching anything', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await runMainWithArgv([
      'export-liked-jobs',
      'user=user-1',
      'out=/tmp/liked.csv',
      'preference=maybe',
    ]);

    expect(fetchJobIdsByUserPreferenceMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Crawler failed:',
      expect.objectContaining({
        message: expect.stringContaining('invalid preference'),
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('job-salary mode is untouched: still queries JobService and calls updateMultiple, without touching sync-core at all', async () => {
    jobServiceFetchAllMock.mockResolvedValueOnce({
      result: [
        { id: 'job-1', salary: '月薪 60,000 元以上', salary_manual: false },
        { id: 'job-2', salary: '月薪 70,000 元以上', salary_manual: true },
      ],
      count: 2,
      searchParams: '',
    });

    await runMainWithArgv(['job-salary']);

    expect(jobServiceFetchAllMock).toHaveBeenCalledWith({
      select: 'id,salary,salary_manual',
    });
    expect(jobServiceUpdateMultipleMock).toHaveBeenCalledTimes(1);
    const updateCalls =
      jobServiceUpdateMultipleMock.mock.calls as unknown as [
        { id: string }[],
      ][];
    const updated = updateCalls[0][0];
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('job-1');
    expect(resolveSourcesToProcessMock).not.toHaveBeenCalled();
    expect(createStalenessSyncEngineMock).not.toHaveBeenCalled();
  });

  it('job-keyword mode resolves the configured model and forwards a freshly constructed OpenRouterLlmClient to generateJobKeywordsFromLines, without touching sync-core at all', async () => {
    aiLlmSettingGetValueMock.mockResolvedValueOnce('some/model-id');

    await runMainWithArgv(['job-keyword']);

    expect(aiLlmSettingGetValueMock).toHaveBeenCalledWith('default_model');
    expect(openRouterLlmClientMock).toHaveBeenCalledWith('some/model-id');
    expect(generateJobKeywordsFromLinesMock).toHaveBeenCalledTimes(1);
    const generateCalls = generateJobKeywordsFromLinesMock.mock
      .calls as unknown as [{ llmClient: unknown }][];
    expect(generateCalls[0][0].llmClient).toEqual({
      marker: 'fake-llm-client',
    });
    expect(jobServiceFetchAllMock).not.toHaveBeenCalled();
    expect(resolveSourcesToProcessMock).not.toHaveBeenCalled();
    expect(createStalenessSyncEngineMock).not.toHaveBeenCalled();
  });

  it('job-keyword mode falls back to DEFAULT_MODEL_FALLBACK when no model setting is configured', async () => {
    aiLlmSettingGetValueMock.mockResolvedValueOnce(null);

    await runMainWithArgv(['job-keyword']);

    expect(openRouterLlmClientMock).toHaveBeenCalledWith(
      'meta-llama/llama-3.3-70b-instruct:free',
    );
  });

  it('crawl mode never touches createJobStalenessSyncConfig/createStalenessSyncEngine (mode-exclusive dispatch)', async () => {
    await runMainWithArgv(['crawl']);

    expect(createJobStalenessSyncConfigMock).not.toHaveBeenCalled();
    expect(createStalenessSyncEngineMock).not.toHaveBeenCalled();
  });

  it('re-crawl mode never touches resolveSourcesToProcess (mode-exclusive dispatch)', async () => {
    await runMainWithArgv(['re-crawl']);

    expect(resolveSourcesToProcessMock).not.toHaveBeenCalled();
  });

  it('crawl-from-file=<path> mode calls ingestHandoffFile with the path and the same keywords array used by other modes, without touching any other mode\'s logic (mode-exclusive dispatch)', async () => {
    await runMainWithArgv(['crawl-from-file=/tmp/handoff.json']);

    expect(ingestHandoffFileMock).toHaveBeenCalledWith(
      '/tmp/handoff.json',
      ['Node.js'],
    );
    expect(resolveSourcesToProcessMock).not.toHaveBeenCalled();
    expect(createStalenessSyncEngineMock).not.toHaveBeenCalled();
    expect(jobServiceFetchAllMock).not.toHaveBeenCalled();
    expect(generateJobKeywordsFromLinesMock).not.toHaveBeenCalled();
  });

  it('crawl-from-file mode (no path given) rejects with a clear, descriptive error before calling ingestHandoffFile, and main() reports it via the top-level catch handler', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await runMainWithArgv(['crawl-from-file']);

    expect(ingestHandoffFileMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Crawler failed:',
      expect.objectContaining({
        message: expect.stringContaining('crawl-from-file'),
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
