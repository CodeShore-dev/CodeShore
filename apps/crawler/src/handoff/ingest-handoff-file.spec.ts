import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HandoffFile, HandoffPage } from './types';

// `ingest-handoff-file.ts` mirrors `main.ts`'s existing `crawl` mode
// `PuppeteerCrawler` construction SHAPE (see main.ts's `makeCrawlerOptions`),
// but for this feature it must NEVER actually launch a browser -- a prior
// attempt at this exact task hung the test runner for 3+ minutes because its
// mocked `PuppeteerCrawler` didn't fully replace the real one. `crawlee` and
// `@codeshore/crawler-core` (which pulls in the real puppeteer/stealth-plugin
// chain) are both mocked here the same way `main.spec.ts` mocks them, so no
// real browser/async work can ever run in this file.
const { puppeteerCrawlerMock, puppeteerRunMock, configSetMock } = vi.hoisted(
  () => {
    const runMockInner = vi.fn(async () => undefined);
    return {
      puppeteerCrawlerMock: vi.fn((_options: { requestHandler: unknown }) => ({
        run: runMockInner,
      })),
      puppeteerRunMock: runMockInner,
      configSetMock: vi.fn(),
    };
  },
);
vi.mock('crawlee', () => ({
  Configuration: {
    getGlobalConfig: vi.fn(() => ({ set: configSetMock })),
  },
  PuppeteerCrawler: puppeteerCrawlerMock,
}));

// `getSourceKey` is reimplemented with its REAL page-param-stripping
// behavior (not a bare `vi.fn()` stand-in) -- this is the exact seam the
// production code now depends on to reconcile `HandoffPage.sourceUrl` (full
// URL, `?page=N` included) against `SourceRegistry.fetchPendingSources()`'s
// already-page-stripped `SourceLocation.url`. A no-op/identity stub here
// would silently mask a regression of that mismatch, the same way the
// original (pre-fix) test suite did.
vi.mock('@codeshore/crawler-core', () => ({
  createStealthLaunchContext: vi.fn(() => ({ launchContext: 'fake' })),
  createStealthPreNavigationHook: vi.fn(() => ({ hook: 'fake' })),
  randomDelay: vi.fn(async () => undefined),
  getSourceKey: (url: string) => {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('page');
    return urlObj.toString();
  },
}));

// `loadHandoffFile` (task 2.2) is a fully separate, already-tested seam; mock
// it here so this spec controls exactly what `validPages`/`issues` the
// orchestrator sees per test, without touching the real filesystem.
const { loadHandoffFileMock } = vi.hoisted(() => ({
  loadHandoffFileMock: vi.fn(),
}));
vi.mock('./load-handoff-file', () => ({
  loadHandoffFile: loadHandoffFileMock,
}));

// `../persistence` constructs real Supabase-backed services at module scope
// (`syncRepository`/`sourceRegistry`); stub `sourceRegistry` to a minimal
// fake exposing only the one method this task is allowed to call --
// `fetchPendingSources()` -- matching how `main.spec.ts` stubs `./persistence`.
const { fetchPendingSourcesMock } = vi.hoisted(() => ({
  fetchPendingSourcesMock: vi.fn(),
}));
vi.mock('../persistence', () => ({
  sourceRegistry: { fetchPendingSources: fetchPendingSourcesMock },
}));

// Cake's `createHandler`/`parsePagination`/`extractItems` (task 2.3) and
// `toRawItemFromMinimal` (task 2.4) are mocked wholesale -- this task must
// prove it CALLS these seams correctly, not re-verify their own internals
// (already covered by `cake/handler.spec.ts`/`cake/handoff-adapter.spec.ts`).
const {
  createHandlerCakeMock,
  cakeIngestMock,
  cakeFlushPendingMock,
  parsePaginationCakeMock,
  extractItemsCakeMock,
} = vi.hoisted(() => {
  const ingestMockInner = vi.fn(async () => undefined);
  const flushMockInner = vi.fn(async () => undefined);
  const routerMockInner = {
    router: { marker: 'fake-cake-router' },
    flushPending: flushMockInner,
    ingestCapturedListPage: ingestMockInner,
  };
  return {
    createHandlerCakeMock: vi.fn(() => routerMockInner),
    cakeIngestMock: ingestMockInner,
    cakeFlushPendingMock: flushMockInner,
    parsePaginationCakeMock: vi.fn(),
    extractItemsCakeMock: vi.fn(),
  };
});
vi.mock('../cake/handler', () => ({
  createHandler: createHandlerCakeMock,
  parsePagination: parsePaginationCakeMock,
  extractItems: extractItemsCakeMock,
}));

const { toRawItemFromMinimalCakeMock } = vi.hoisted(() => ({
  toRawItemFromMinimalCakeMock: vi.fn(),
}));
vi.mock('../cake/handoff-adapter', () => ({
  toRawItemFromMinimal: toRawItemFromMinimalCakeMock,
}));

// Same for 104 (tasks 2.3/2.5).
const {
  createHandler104Mock,
  handler104IngestMock,
  handler104FlushPendingMock,
  parsePagination104Mock,
  extractItems104Mock,
} = vi.hoisted(() => {
  const ingestMockInner = vi.fn(async () => undefined);
  const flushMockInner = vi.fn(async () => undefined);
  const routerMockInner = {
    router: { marker: 'fake-104-router' },
    flushPending: flushMockInner,
    ingestCapturedListPage: ingestMockInner,
  };
  return {
    createHandler104Mock: vi.fn(() => routerMockInner),
    handler104IngestMock: ingestMockInner,
    handler104FlushPendingMock: flushMockInner,
    parsePagination104Mock: vi.fn(),
    extractItems104Mock: vi.fn(),
  };
});
vi.mock('../104/handler', () => ({
  createHandler: createHandler104Mock,
  parsePagination: parsePagination104Mock,
  extractItems: extractItems104Mock,
}));

const { toRawItemFromMinimal104Mock } = vi.hoisted(() => ({
  toRawItemFromMinimal104Mock: vi.fn(),
}));
vi.mock('../104/handoff-adapter', () => ({
  toRawItemFromMinimal: toRawItemFromMinimal104Mock,
}));

import { ingestHandoffFile } from './ingest-handoff-file';

function buildCakeFullPage(overrides: Partial<HandoffPage> = {}): HandoffPage {
  return {
    sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
    pageIndex: 1,
    totalPages: 3,
    captureMode: 'full',
    rawResponse: { marker: 'fake-cake-raw-response' },
    ...overrides,
  };
}

function buildHandoffFile(
  host: HandoffFile['host'],
  pages: HandoffPage[],
): HandoffFile {
  return { host, pages };
}

/**
 * Mirrors the REAL `SourceRegistry` contract (`libs/data-utils/src/lib/api/
 * job_source_url.service.ts`'s `_removePageIndexFromURL`, used by both
 * `upsertJobSourceURL`/`createJobSourceURLs`): stored/returned
 * `SourceLocation.url` values never carry a `page` query param, unlike
 * `HandoffPage.sourceUrl` (which always does). Every `fetchPendingSourcesMock`
 * fixture below is built through this helper -- NOT by reusing
 * `page.sourceUrl` verbatim -- so a regression that compares the two URL
 * shapes directly (the exact bug this suite caught) fails loudly instead of
 * being masked by fixtures that accidentally match the buggy implementation.
 */
function toBaseUrl(url: string): string {
  const urlObj = new URL(url);
  urlObj.searchParams.delete('page');
  return urlObj.toString();
}

describe('ingestHandoffFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPendingSourcesMock.mockResolvedValue([]);
    parsePaginationCakeMock.mockReturnValue({
      currentPage: 1,
      totalPages: 3,
      totalEntries: 45,
    });
    extractItemsCakeMock.mockReturnValue([{ id: 'job-1', path: 'job-1' }]);
    parsePagination104Mock.mockReturnValue({
      currentPage: 1,
      totalPages: 3,
      totalEntries: 45,
    });
    extractItems104Mock.mockReturnValue([{ id: 'job-1', jobNo: 'job-1' }]);
  });

  it('skips pages not present in fetchPendingSources() and counts them, without calling ingestCapturedListPage for them', async () => {
    const pendingPage = buildCakeFullPage({
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
    });
    const staleCompletedPage = buildCakeFullPage({
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=2',
      pageIndex: 2,
    });
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [pendingPage, staleCompletedPage]),
      validPages: [pendingPage, staleCompletedPage],
      issues: [],
    });
    // Only page 1 is still pending -- page 2 is either already completed or
    // was never registered, and must be skipped (Requirement 4.3). Both
    // pages share the same base URL (only their `?page=N`/`pageIndex` differ)
    // -- registered here as the real registry would, page-param-stripped.
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(pendingPage.sourceUrl), pageIndex: 1 },
    ]);

    const summary = await ingestHandoffFile('/tmp/handoff.json', ['Node.js']);

    expect(cakeIngestMock).toHaveBeenCalledTimes(1);
    expect(cakeIngestMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: pendingPage.sourceUrl }),
    );
    expect(summary.processedPages).toBe(1);
    expect(summary.skippedAlreadyCompletedPages).toBe(1);
  });

  it('matches pending pages by (page-stripped base URL, pageIndex) together, not full-URL string equality — proving multiple pages of one source are each matched independently', async () => {
    // Regression test for a bug where `HandoffPage.sourceUrl` (full URL,
    // `?page=N` included) was compared directly against
    // `SourceLocation.url` (already page-stripped by the persistence layer):
    // that mismatch meant EVERY handoff page was misclassified as
    // "already completed" in production, silently defeating Requirement 4.3.
    // All three pages below share one base URL, differing only in
    // `?page=N`/`pageIndex` -- exactly the shape that string-equality on the
    // full URL gets wrong but a (normalized-url, pageIndex) pair gets right.
    const baseUrl = 'https://www.cake.me/api/client/v1/jobs/search';
    const page1 = buildCakeFullPage({ sourceUrl: `${baseUrl}?page=1`, pageIndex: 1 });
    const page2 = buildCakeFullPage({ sourceUrl: `${baseUrl}?page=2`, pageIndex: 2 });
    const page3 = buildCakeFullPage({ sourceUrl: `${baseUrl}?page=3`, pageIndex: 3 });
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [page1, page2, page3]),
      validPages: [page1, page2, page3],
      issues: [],
    });
    // Registered exactly as the real SourceRegistry would: base URL only,
    // page 2 intentionally absent from the pending set.
    fetchPendingSourcesMock.mockResolvedValue([
      { url: baseUrl, pageIndex: 1 },
      { url: baseUrl, pageIndex: 3 },
    ]);

    const summary = await ingestHandoffFile('/tmp/handoff.json', []);

    expect(cakeIngestMock).toHaveBeenCalledTimes(2);
    expect(cakeIngestMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: page1.sourceUrl }),
    );
    expect(cakeIngestMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: page3.sourceUrl }),
    );
    expect(cakeIngestMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: page2.sourceUrl }),
    );
    expect(summary.processedPages).toBe(2);
    expect(summary.skippedAlreadyCompletedPages).toBe(1);
  });

  it('routes a cake.me handoff file to the Cake handler/adapter/extractItems, never touching the 104 equivalents', async () => {
    const page = buildCakeFullPage();
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [page]),
      validPages: [page],
      issues: [],
    });
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(page.sourceUrl), pageIndex: page.pageIndex },
    ]);

    await ingestHandoffFile('/tmp/handoff.json', ['Node.js']);

    expect(createHandlerCakeMock).toHaveBeenCalledWith(['Node.js']);
    expect(parsePaginationCakeMock).toHaveBeenCalled();
    expect(extractItemsCakeMock).toHaveBeenCalled();
    expect(createHandler104Mock).not.toHaveBeenCalled();
    expect(parsePagination104Mock).not.toHaveBeenCalled();
    expect(extractItems104Mock).not.toHaveBeenCalled();
    expect(handler104IngestMock).not.toHaveBeenCalled();
  });

  it('routes a 104.com.tw handoff file to the 104 handler/adapter/extractItems, never touching the Cake equivalents', async () => {
    const page: HandoffPage = {
      sourceUrl: 'https://www.104.com.tw/jobs/search/api/jobs?page=1',
      pageIndex: 1,
      totalPages: 2,
      captureMode: 'full',
      rawResponse: { marker: 'fake-104-raw-response' },
    };
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('104.com.tw', [page]),
      validPages: [page],
      issues: [],
    });
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(page.sourceUrl), pageIndex: page.pageIndex },
    ]);

    await ingestHandoffFile('/tmp/handoff.json', ['Node.js']);

    expect(createHandler104Mock).toHaveBeenCalledWith(['Node.js']);
    expect(parsePagination104Mock).toHaveBeenCalled();
    expect(extractItems104Mock).toHaveBeenCalled();
    expect(createHandlerCakeMock).not.toHaveBeenCalled();
    expect(parsePaginationCakeMock).not.toHaveBeenCalled();
    expect(extractItemsCakeMock).not.toHaveBeenCalled();
    expect(cakeIngestMock).not.toHaveBeenCalled();
  });

  it('full-mode page calls extractItems/parsePagination on rawResponse and feeds the parsed pagination + items into ingestCapturedListPage', async () => {
    const page = buildCakeFullPage({
      rawResponse: { marker: 'specific-raw-response' },
    });
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [page]),
      validPages: [page],
      issues: [],
    });
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(page.sourceUrl), pageIndex: page.pageIndex },
    ]);
    parsePaginationCakeMock.mockReturnValue({
      currentPage: 7,
      totalPages: 9,
      totalEntries: 123,
    });
    const items = [{ id: 'a' }, { id: 'b' }];
    extractItemsCakeMock.mockReturnValue(items);

    await ingestHandoffFile('/tmp/handoff.json', []);

    expect(extractItemsCakeMock).toHaveBeenCalledWith(page.rawResponse);
    expect(parsePaginationCakeMock).toHaveBeenCalledWith(page.rawResponse);
    expect(cakeIngestMock).toHaveBeenCalledWith({
      url: page.sourceUrl,
      currentPage: 7,
      totalPages: 9,
      totalEntries: 123,
      items,
    });
  });

  it('degraded-mode page calls toRawItemFromMinimal per item and uses page.pageIndex/totalPages/items.length for the captured page metadata', async () => {
    const minimalItemA = {
      url: 'https://www.cake.me/companies/acme/jobs/a',
      title: 'A',
      location: 'Taipei',
      companyName: 'Acme',
    };
    const minimalItemB = {
      url: 'https://www.cake.me/companies/acme/jobs/b',
      title: 'B',
      location: 'Taipei',
      companyName: 'Acme',
    };
    const page: HandoffPage = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=2',
      pageIndex: 2,
      totalPages: 4,
      captureMode: 'degraded',
      minimalItems: [minimalItemA, minimalItemB] as never,
    };
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [page]),
      validPages: [page],
      issues: [],
    });
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(page.sourceUrl), pageIndex: page.pageIndex },
    ]);
    toRawItemFromMinimalCakeMock.mockImplementation(
      (item: { url: string }) => ({ id: item.url }),
    );

    await ingestHandoffFile('/tmp/handoff.json', []);

    expect(toRawItemFromMinimalCakeMock).toHaveBeenCalledTimes(2);
    expect(toRawItemFromMinimalCakeMock).toHaveBeenNthCalledWith(1, minimalItemA);
    expect(toRawItemFromMinimalCakeMock).toHaveBeenNthCalledWith(2, minimalItemB);
    expect(extractItemsCakeMock).not.toHaveBeenCalled();
    expect(parsePaginationCakeMock).not.toHaveBeenCalled();
    expect(cakeIngestMock).toHaveBeenCalledWith({
      url: page.sourceUrl,
      currentPage: 2,
      totalPages: 4,
      totalEntries: 2,
      items: [{ id: minimalItemA.url }, { id: minimalItemB.url }],
    });
  });

  it('constructs a PuppeteerCrawler with the host router as requestHandler and calls run([]) with an empty array, then flushPending()', async () => {
    const page = buildCakeFullPage();
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [page]),
      validPages: [page],
      issues: [],
    });
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(page.sourceUrl), pageIndex: page.pageIndex },
    ]);

    await ingestHandoffFile('/tmp/handoff.json', []);

    expect(configSetMock).toHaveBeenCalledWith('purgeOnStart', true);
    expect(puppeteerCrawlerMock).toHaveBeenCalledTimes(1);
    const constructorArgs = puppeteerCrawlerMock.mock.calls[0][0] as {
      requestHandler: unknown;
    };
    expect(constructorArgs.requestHandler).toEqual({
      marker: 'fake-cake-router',
    });
    expect(puppeteerRunMock).toHaveBeenCalledWith([]);
    expect(cakeFlushPendingMock).toHaveBeenCalledTimes(1);
  });

  it('does not crash the whole run when a page fails to convert, and neither counts it as processed nor as skipped', async () => {
    const badPage = buildCakeFullPage({
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
    });
    const goodPage = buildCakeFullPage({
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=2',
      pageIndex: 2,
    });
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [badPage, goodPage]),
      validPages: [badPage, goodPage],
      issues: [],
    });
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(badPage.sourceUrl), pageIndex: badPage.pageIndex },
      { url: toBaseUrl(goodPage.sourceUrl), pageIndex: goodPage.pageIndex },
    ]);
    extractItemsCakeMock
      .mockImplementationOnce(() => {
        throw new Error('malformed rawResponse for page 1');
      })
      .mockImplementationOnce(() => [{ id: 'ok' }]);

    const summary = await ingestHandoffFile('/tmp/handoff.json', []);

    expect(cakeIngestMock).toHaveBeenCalledTimes(1);
    expect(cakeIngestMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: goodPage.sourceUrl }),
    );
    expect(summary.processedPages).toBe(1);
    expect(summary.skippedAlreadyCompletedPages).toBe(0);
  });

  it('populates HandoffIngestionSummary fields correctly across a realistic mixed scenario (pending/skipped/full/degraded/issues)', async () => {
    const fullPage = buildCakeFullPage({
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
    });
    const degradedPage: HandoffPage = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=2',
      pageIndex: 2,
      totalPages: 3,
      captureMode: 'degraded',
      minimalItems: [
        {
          url: 'https://www.cake.me/companies/acme/jobs/c',
          title: 'C',
          location: 'Taipei',
          companyName: 'Acme',
        },
      ] as never,
    };
    const staleCompletedPage = buildCakeFullPage({
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=3',
      pageIndex: 3,
    });
    const issues = [{ pageIndex: 4, itemIndex: 0, reason: 'missing location' }];
    loadHandoffFileMock.mockResolvedValue({
      file: buildHandoffFile('cake.me', [fullPage, degradedPage, staleCompletedPage]),
      validPages: [fullPage, degradedPage, staleCompletedPage],
      issues,
    });
    fetchPendingSourcesMock.mockResolvedValue([
      { url: toBaseUrl(fullPage.sourceUrl), pageIndex: fullPage.pageIndex },
      { url: toBaseUrl(degradedPage.sourceUrl), pageIndex: degradedPage.pageIndex },
    ]);
    toRawItemFromMinimalCakeMock.mockReturnValue({ id: 'c' });

    const summary = await ingestHandoffFile('/tmp/handoff.json', []);

    expect(summary).toEqual({
      processedPages: 2,
      skippedAlreadyCompletedPages: 1,
      rejectedItemIssues: issues,
    });
  });

  it('propagates a whole-file structural load failure without catching it, and never calls fetchPendingSources', async () => {
    const loadError = new Error(
      'Handoff file structural validation failed: "host" must be one of cake.me, 104.com.tw',
    );
    loadHandoffFileMock.mockRejectedValue(loadError);

    await expect(
      ingestHandoffFile('/tmp/bad-handoff.json', []),
    ).rejects.toThrow(loadError);
    expect(fetchPendingSourcesMock).not.toHaveBeenCalled();
    expect(createHandlerCakeMock).not.toHaveBeenCalled();
    expect(createHandler104Mock).not.toHaveBeenCalled();
  });
});
