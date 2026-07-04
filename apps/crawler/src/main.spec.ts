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

import { parseWhereExpr, resolveCliArgs, splitTopLevel } from './main';

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
const { mvTechFetchAllMock, jobServiceFetchAllMock, jobServiceUpdateMultipleMock, jobKeywordUpdateMultipleMock } =
  vi.hoisted(() => ({
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
    jobKeywordUpdateMultipleMock: vi.fn(async () => undefined),
  }));

vi.mock('@codeshore/data-utils', () => ({
  MvTechService: vi.fn(() => ({ fetchAll: mvTechFetchAllMock })),
  JobService: vi.fn(() => ({
    fetchAll: jobServiceFetchAllMock,
    updateMultiple: jobServiceUpdateMultipleMock,
  })),
  JobKeywordService: vi.fn(() => ({
    updateMultiple: jobKeywordUpdateMultipleMock,
  })),
}));

// `@codeshore/crawler-core` constructs a real stealth puppeteer launch
// context; mock it so `main.ts`'s module-level `createStealthLaunchContext`/
// `createStealthPreNavigationHook` calls stay cheap and inert.
vi.mock('@codeshore/crawler-core', () => ({
  createStealthLaunchContext: vi.fn(() => ({ launchContext: 'fake' })),
  createStealthPreNavigationHook: vi.fn(() => ({ hook: 'fake' })),
  setPageIndex: (url: string, pageIndex: number) => `${url}?page=${pageIndex}`,
}));

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
const { fakeSourceRegistry } = vi.hoisted(() => ({
  fakeSourceRegistry: { marker: 'fake-source-registry' },
}));
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

// `./104/handler` and `./cake/handler` are DOM-extraction call paths this
// task must NOT touch. Stub them minimally so `crawl` mode dispatch can be
// exercised without invoking real `PuppeteerCrawler`/`crawlee`.
const { flushPending104Mock, flushPendingCakeMock } = vi.hoisted(() => ({
  flushPending104Mock: vi.fn(async () => undefined),
  flushPendingCakeMock: vi.fn(async () => undefined),
}));
vi.mock('./104/handler', () => ({
  createHandler: vi.fn(() => ({
    router: {},
    flushPending: flushPending104Mock,
  })),
}));
vi.mock('./cake/handler', () => ({
  createHandler: vi.fn(() => ({
    router: {},
    flushPending: flushPendingCakeMock,
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
    expect(handler104.createHandler).toHaveBeenCalledWith(['Node.js']);
    expect(flushPending104Mock).toHaveBeenCalledTimes(1);
  });

  it('crawl mode dispatches resolved Cake-host source locations to the untouched Cake handler', async () => {
    resolveSourcesToProcessMock.mockResolvedValueOnce([
      { url: 'https://www.cake.me/companies/x/jobs', pageIndex: 1 },
    ]);

    await runMainWithArgv(['crawl']);

    const handlerCake = await import('./cake/handler');
    expect(handlerCake.createHandler).toHaveBeenCalledWith(['Node.js']);
    expect(flushPendingCakeMock).toHaveBeenCalledTimes(1);
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

  it('job-keyword mode is untouched: still queries JobService and calls JobKeywordService.updateMultiple, without touching sync-core at all', async () => {
    jobServiceFetchAllMock.mockResolvedValueOnce({
      result: [{ id: 'job-1', description: 'Node.js 後端工程師' }],
      count: 1,
      searchParams: '',
    });

    await runMainWithArgv(['job-keyword']);

    expect(jobServiceFetchAllMock).toHaveBeenCalledWith({
      select: 'id,description',
    });
    expect(jobKeywordUpdateMultipleMock).toHaveBeenCalledTimes(1);
    expect(resolveSourcesToProcessMock).not.toHaveBeenCalled();
    expect(createStalenessSyncEngineMock).not.toHaveBeenCalled();
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
});
