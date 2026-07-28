import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Task 4.1 (design.md "Testing Strategy", requirements 1.2, 3.2-3.5,
 * 4.1-4.4). Every module this feature is built from already has thorough
 * unit-level coverage with the layer below it mocked (types validation in
 * `types.spec.ts`, file loading/validation in `load-handoff-file.spec.ts`,
 * per-host adapters in `{cake,104}/handoff-adapter.spec.ts`, the
 * `ingestCapturedListPage` seam in `crawl-router.spec.ts`, and the
 * orchestrator's own wiring in `ingest-handoff-file.spec.ts` with the host
 * handlers themselves mocked out). This suite's job is different: prove the
 * REAL chain fits together end-to-end — a real temp JSON file on disk, read
 * by the real `loadHandoffFile`, ingested by the real `ingestHandoffFile`,
 * routed through the REAL `cake/handler.ts`/`104/handler.ts`
 * `createHandler`/`extractItems`/`parsePagination`, the REAL
 * `cake/handoff-adapter.ts`/`104/handoff-adapter.ts` `toRawItemFromMinimal`,
 * the REAL `@codeshore/sync-core` `createSyncRouter`, and the REAL
 * `@codeshore/crawler-core` `createCrawlRouter`/`ingestCapturedListPage`
 * seam — none of these are mocked here.
 *
 * Mocking is pushed down only to the genuinely unsafe I/O boundary:
 * - `crawlee`'s `PuppeteerCrawler`/`Configuration`/`RequestQueue` (never a
 *   real browser, never real Crawlee on-disk request-queue storage) — kept
 *   via `importOriginal` so the real `createPuppeteerRouter` (used
 *   internally by the real `createCrawlRouter`) still runs, exactly the
 *   pattern already reviewer-approved in `crawl-router.spec.ts`.
 * - `apps/crawler/src/persistence.ts` (never a real Supabase call) — mocked
 *   wholesale the same way `cake/handler.spec.ts`/`104/handler.spec.ts` mock
 *   its `@codeshore/data-utils` dependency, just one layer higher, per this
 *   task's brief ("mock ... at persistence.ts itself").
 *
 * `createStealthLaunchContext`/`createStealthPreNavigationHook` (used by
 * `ingest-handoff-file.ts`'s `runIngestionCrawler`) are left REAL and
 * unmocked: they only build launch-option objects (`puppeteer-extra` +
 * `puppeteer-extra-plugin-stealth` config), synchronously, with no browser
 * ever launched — confirmed safe by `browser/stealth-launch.spec.ts`, which
 * calls them directly, unmocked, in this same monorepo's existing passing
 * test suite. Since `PuppeteerCrawler.run()` below is a no-op mock, none of
 * the `preNavigationHooks` these produce are ever invoked either.
 *
 * Requirement 4.2 coverage note (honest split, not implied full coverage
 * from this file alone): `ingestCapturedListPage`
 * (`libs/crawler-core/src/router/crawl-router.ts`) reports a page as
 * "completed" through exactly two paths — (a) immediately, when the page
 * enqueues zero DETAIL requests (every item already known), or (b) later,
 * once every DETAIL request enqueued for that page has been processed by
 * the `'DETAIL'` handler. Because this suite correctly mocks
 * `PuppeteerCrawler.run()` as a no-op (Crawlee must never run a real
 * browser), path (b) is structurally unreachable here — there is no real
 * DETAIL handler execution in this file. Scenario 7 below exercises path
 * (a) end-to-end through the real `createSyncRouter`/`sourceRegistry`
 * wiring. Path (b) is already covered by
 * `libs/crawler-core/src/router/crawl-router.spec.ts` (its task 2.1 tests,
 * covering Requirements 4.1, 4.2, 4.4 via a scripted mock DETAIL handler
 * invocation) and is intentionally not duplicated here.
 */
const {
  puppeteerCrawlerMock,
  puppeteerRunMock,
  configSetMock,
  requestQueueOpenMock,
  requestQueueAddRequestsMock,
} = vi.hoisted(() => {
  const runMockInner = vi.fn(async () => undefined);
  const addRequestsMockInner = vi.fn(
    async (
      _requests: Array<{ url: string; label: string; userData: unknown }>,
    ) => undefined,
  );
  return {
    puppeteerCrawlerMock: vi.fn((_options: { requestHandler: unknown }) => ({
      run: runMockInner,
    })),
    puppeteerRunMock: runMockInner,
    configSetMock: vi.fn(),
    requestQueueOpenMock: vi.fn(async () => ({
      addRequests: addRequestsMockInner,
    })),
    requestQueueAddRequestsMock: addRequestsMockInner,
  };
});

vi.mock('crawlee', async importOriginal => {
  const actual = await importOriginal<typeof import('crawlee')>();
  return {
    ...actual,
    Configuration: {
      getGlobalConfig: vi.fn(() => ({ set: configSetMock })),
    },
    PuppeteerCrawler: puppeteerCrawlerMock,
    RequestQueue: { open: requestQueueOpenMock },
  };
});

// `persistence.ts` constructs real Supabase-backed services
// (`JobService`/`CompanyService`/.../`JobSourceURLService`) at module scope;
// mocked wholesale here (not `@codeshore/data-utils`) per this task's brief,
// matching what `cake/handler.ts`, `104/handler.ts`, and
// `ingest-handoff-file.ts` all import as `../persistence` — this single
// mock is shared by all three real modules' real imports of that path.
const {
  fetchPendingSourcesMock,
  fetchExistingMock,
  upsertEntitiesMock,
  registerPendingPagesMock,
  markSourceStatusMock,
} = vi.hoisted(() => ({
  fetchPendingSourcesMock: vi.fn(async () => [] as { url: string; pageIndex: number }[]),
  fetchExistingMock: vi.fn(async () => new Map()),
  upsertEntitiesMock: vi.fn(async () => undefined),
  registerPendingPagesMock: vi.fn(async () => undefined),
  markSourceStatusMock: vi.fn(async () => undefined),
}));

vi.mock('../persistence', () => ({
  sourceRegistry: {
    fetchPendingSources: fetchPendingSourcesMock,
    registerPendingPages: registerPendingPagesMock,
    markSourceStatus: markSourceStatusMock,
  },
  syncRepository: {
    fetchExisting: fetchExistingMock,
    upsertEntities: upsertEntitiesMock,
  },
}));

import { getSourceKey } from '@codeshore/crawler-core';

import { ingestHandoffFile } from './ingest-handoff-file';

// ---------------------------------------------------------------------------
// Fixture builders. Field sets mirror design.md's "Data Models" JSON examples
// and only include the fields the REAL parsePagination/extractItems/
// toRawItemFromMinimal/transformItem functions actually read (proven by
// reading `cake/handler.ts`, `104/handler.ts`, `cake/handoff-adapter.ts`,
// `104/handoff-adapter.ts` in full) — extra untouched JobOnAPI fields would
// just be noise since `rawResponse`'s declared type is `unknown`.
// ---------------------------------------------------------------------------

interface CakeRawItemFixture {
  path: string;
  title: string;
  page: { path: string };
}

function buildCakeFullRawResponse(options: {
  items: CakeRawItemFixture[];
  currentPage: number;
  totalPages: number;
  totalEntries: number;
}): unknown {
  return {
    current_page: options.currentPage,
    total_pages: options.totalPages,
    total_entries: options.totalEntries,
    per_page: options.items.length,
    data: options.items,
  };
}

interface Job104RawItemFixture {
  link: { job: string };
  jobName: string;
}

function build104FullRawResponse(options: {
  items: Job104RawItemFixture[];
  currentPage: number;
  totalPages: number;
  totalEntries: number;
}): unknown {
  return {
    data: options.items,
    metadata: {
      pagination: {
        count: options.items.length,
        currentPage: options.currentPage,
        lastPage: options.totalPages,
        total: options.totalEntries,
      },
    },
  };
}

function buildCakeMinimalItem(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://www.cake.me/companies/acme-inc/jobs/senior-backend-engineer-2',
    title: 'Backend Engineer 2',
    location: '台北市信義區',
    companyName: 'Acme Inc',
    ...overrides,
  };
}

function build104MinimalItem(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://www.104.com.tw/job/67890',
    title: '前端工程師',
    location: '台北市大安區',
    companyName: 'Beta Co',
    companyLink: 'https://www.104.com.tw/company/beta',
    ...overrides,
  };
}

interface HandoffPageFixture {
  sourceUrl: string;
  pageIndex: number;
  totalPages: number;
  captureMode: 'full' | 'degraded';
  rawResponse?: unknown;
  minimalItems?: Record<string, unknown>[];
}

function buildHandoffFileJson(
  host: 'cake.me' | '104.com.tw',
  pages: HandoffPageFixture[],
): string {
  return JSON.stringify({ host, pages });
}

/** Real `getSourceKey`-normalized `(url, pageIndex)` pair, matching exactly
 * what the real `sourceRegistry.fetchPendingSources()` would return for a
 * page that's still pending — see `ingest-handoff-file.ts`'s
 * `buildPendingKey` doc comment on why this normalization is required. */
function pendingEntryFor(page: HandoffPageFixture) {
  return { url: getSourceKey(page.sourceUrl), pageIndex: page.pageIndex };
}

describe('handoff ingestion end-to-end (real loadHandoffFile → real ingestHandoffFile → real host adapters/handlers)', () => {
  const writtenFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(
      writtenFiles.splice(0).map(async filePath => {
        await fs.rm(filePath, { force: true });
      }),
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchPendingSourcesMock.mockResolvedValue([]);
    fetchExistingMock.mockResolvedValue(new Map());
  });

  const writeTempHandoffFile = async (content: string): Promise<string> => {
    const filePath = path.join(
      os.tmpdir(),
      `handoff-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    await fs.writeFile(filePath, content, 'utf-8');
    writtenFiles.push(filePath);
    return filePath;
  };

  /** Every request queued across every `RequestQueue.open().addRequests(...)`
   * call made during the test, flattened for easy assertions regardless of
   * how many pages/calls produced them. */
  const allQueuedRequests = () =>
    requestQueueAddRequestsMock.mock.calls.flatMap(
      call => call[0] as Array<{ url: string; label: string; userData: unknown }>,
    );

  it('1. full capture (Cake): real extractItems/parsePagination/transformItem run and new-item DETAIL requests get queued, existing items are excluded', async () => {
    const page: HandoffPageFixture = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
      totalPages: 3,
      captureMode: 'full',
      rawResponse: buildCakeFullRawResponse({
        currentPage: 1,
        totalPages: 3,
        totalEntries: 45,
        items: [
          { path: 'existing-job', title: 'Existing Job', page: { path: 'acme-inc' } },
          { path: 'senior-backend-engineer', title: 'Backend Engineer', page: { path: 'acme-inc' } },
        ],
      }),
    };
    const filePath = await writeTempHandoffFile(
      buildHandoffFileJson('cake.me', [page]),
    );
    fetchPendingSourcesMock.mockResolvedValue([pendingEntryFor(page)]);
    // Proves the real existing/new determination runs (Requirement 4.1):
    // 'existing-job' is already known, 'senior-backend-engineer' is not.
    fetchExistingMock.mockResolvedValue(
      new Map([
        [
          'existing-job',
          {
            id: 'existing-job',
            updated_at: '2026-01-01T00:00:00.000Z',
            created_at: '2025-01-01T00:00:00.000Z',
            title: 'Existing Job',
            description: 'x',
            location: 'Taipei',
            salary: '',
            salary_manual: false,
            closed: false,
          },
        ],
      ]),
    );

    const summary = await ingestHandoffFile(filePath, ['Node.js']);

    expect(fetchExistingMock).toHaveBeenCalled();
    const queued = allQueuedRequests();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      url: 'https://www.cake.me/companies/acme-inc/jobs/senior-backend-engineer',
      label: 'DETAIL',
      userData: expect.objectContaining({
        id: 'senior-backend-engineer',
        title: 'Backend Engineer',
        needToCreate: true,
      }),
    });
    expect(queued.some(r => r.url.includes('existing-job'))).toBe(false);

    expect(summary.processedPages).toBe(1);
    expect(summary.skippedAlreadyCompletedPages).toBe(0);
    expect(summary.rejectedItemIssues).toEqual([]);

    // Requirement 4.4: the existing DETAIL-crawl / persistence plumbing is
    // reused unmodified — a real PuppeteerCrawler-shaped construction, seeded
    // with an EMPTY array (no list-page navigation), draining only the
    // requests `ingestCapturedListPage` pre-seeded above.
    expect(configSetMock).toHaveBeenCalledWith('purgeOnStart', true);
    expect(puppeteerCrawlerMock).toHaveBeenCalledTimes(1);
    expect(puppeteerRunMock).toHaveBeenCalledWith([]);
  });

  it('2. degraded capture (104): real toRawItemFromMinimal adapter runs and produces correctly-shaped items that flow through to DETAIL enqueue', async () => {
    const minimalItem = build104MinimalItem();
    const page: HandoffPageFixture = {
      sourceUrl: 'https://www.104.com.tw/jobs/search/api/jobs?page=2',
      pageIndex: 2,
      totalPages: 3,
      captureMode: 'degraded',
      minimalItems: [minimalItem],
    };
    const filePath = await writeTempHandoffFile(
      buildHandoffFileJson('104.com.tw', [page]),
    );
    fetchPendingSourcesMock.mockResolvedValue([pendingEntryFor(page)]);

    const summary = await ingestHandoffFile(filePath, []);

    const queued = allQueuedRequests();
    expect(queued).toHaveLength(1);
    // id/url/title below are all derived by the REAL `104/handoff-adapter.ts`
    // toRawItemFromMinimal (id via getIdFromUrl, link.job/jobName copied from
    // the minimal item) then reconstructed by the REAL `104/handler.ts`
    // transformItem (url: job.link.job, title: job.jobName) — a vacuous/
    // over-mocked test would not be able to reproduce this exact shape.
    expect(queued[0]).toMatchObject({
      url: minimalItem.url,
      label: 'DETAIL',
      userData: expect.objectContaining({
        id: '67890',
        title: minimalItem.title,
        needToCreate: true,
      }),
    });

    expect(summary.processedPages).toBe(1);
    expect(summary.skippedAlreadyCompletedPages).toBe(0);
    expect(summary.rejectedItemIssues).toEqual([]);
  });

  it('3. Cake and 104 handoff files each route to and process correctly through their own real host chain, independently', async () => {
    const cakePage: HandoffPageFixture = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
      totalPages: 1,
      captureMode: 'full',
      rawResponse: buildCakeFullRawResponse({
        currentPage: 1,
        totalPages: 1,
        totalEntries: 1,
        items: [
          { path: 'senior-backend-engineer', title: 'Backend Engineer', page: { path: 'acme-inc' } },
        ],
      }),
    };
    const cakeFilePath = await writeTempHandoffFile(
      buildHandoffFileJson('cake.me', [cakePage]),
    );

    const job104Page: HandoffPageFixture = {
      sourceUrl: 'https://www.104.com.tw/jobs/search/api/jobs?page=1',
      pageIndex: 1,
      totalPages: 1,
      captureMode: 'degraded',
      minimalItems: [build104MinimalItem()],
    };
    const job104FilePath = await writeTempHandoffFile(
      buildHandoffFileJson('104.com.tw', [job104Page]),
    );

    fetchPendingSourcesMock.mockResolvedValueOnce([pendingEntryFor(cakePage)]);
    const cakeSummary = await ingestHandoffFile(cakeFilePath, []);

    fetchPendingSourcesMock.mockResolvedValueOnce([pendingEntryFor(job104Page)]);
    const job104Summary = await ingestHandoffFile(job104FilePath, []);

    expect(cakeSummary.processedPages).toBe(1);
    expect(job104Summary.processedPages).toBe(1);

    const queued = allQueuedRequests();
    const cakeRequests = queued.filter(r => r.url.includes('cake.me'));
    const job104Requests = queued.filter(r => r.url.includes('104.com.tw'));
    expect(cakeRequests).toHaveLength(1);
    expect(job104Requests).toHaveLength(1);
    expect(cakeRequests[0].url).toBe(
      'https://www.cake.me/companies/acme-inc/jobs/senior-backend-engineer',
    );
    expect(job104Requests[0].url).toBe('https://www.104.com.tw/job/67890');
  });

  it('4. an already-completed page (absent from fetchPendingSources) is skipped, not processed, and enqueues nothing', async () => {
    const pendingPage: HandoffPageFixture = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
      totalPages: 2,
      captureMode: 'full',
      rawResponse: buildCakeFullRawResponse({
        currentPage: 1,
        totalPages: 2,
        totalEntries: 2,
        items: [{ path: 'job-page-1', title: 'Job Page 1', page: { path: 'acme-inc' } }],
      }),
    };
    const completedPage: HandoffPageFixture = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=2',
      pageIndex: 2,
      totalPages: 2,
      captureMode: 'full',
      rawResponse: buildCakeFullRawResponse({
        currentPage: 2,
        totalPages: 2,
        totalEntries: 2,
        items: [{ path: 'job-page-2', title: 'Job Page 2', page: { path: 'acme-inc' } }],
      }),
    };
    const filePath = await writeTempHandoffFile(
      buildHandoffFileJson('cake.me', [pendingPage, completedPage]),
    );
    // Only page 1 is registered as pending -- page 2 is already completed.
    fetchPendingSourcesMock.mockResolvedValue([pendingEntryFor(pendingPage)]);

    const summary = await ingestHandoffFile(filePath, []);

    const queued = allQueuedRequests();
    expect(queued).toHaveLength(1);
    expect(queued[0].userData).toMatchObject({ id: 'job-page-1' });
    expect(queued.some(r => (r.userData as { id: string }).id === 'job-page-2')).toBe(
      false,
    );

    expect(summary.processedPages).toBe(1);
    expect(summary.skippedAlreadyCompletedPages).toBe(1);
  });

  it('5. a per-item validation error on a degraded page excludes only that item, without affecting the rest of the page', async () => {
    const validItem = buildCakeMinimalItem({
      url: 'https://www.cake.me/companies/acme-inc/jobs/valid-job',
      title: 'Valid Job',
    });
    // Missing the required `location` field entirely (Requirement 3.3).
    const invalidItem = {
      url: 'https://www.cake.me/companies/acme-inc/jobs/invalid-job',
      title: 'Invalid Job',
      companyName: 'Acme Inc',
    };
    const page: HandoffPageFixture = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
      totalPages: 1,
      captureMode: 'degraded',
      minimalItems: [validItem, invalidItem],
    };
    const filePath = await writeTempHandoffFile(
      buildHandoffFileJson('cake.me', [page]),
    );
    fetchPendingSourcesMock.mockResolvedValue([pendingEntryFor(page)]);

    const summary = await ingestHandoffFile(filePath, []);

    expect(summary.rejectedItemIssues).toHaveLength(1);
    expect(summary.rejectedItemIssues[0]).toMatchObject({
      pageIndex: 1,
      itemIndex: 1,
    });
    expect(summary.rejectedItemIssues[0].reason.toLowerCase()).toContain(
      'location',
    );

    const queued = allQueuedRequests();
    expect(queued).toHaveLength(1);
    expect(queued[0].url).toBe(
      'https://www.cake.me/companies/acme-inc/jobs/valid-job',
    );
    expect(queued.some(r => r.url.includes('invalid-job'))).toBe(false);

    expect(summary.processedPages).toBe(1);
  });

  it('7. a page whose every item is already known enqueues zero DETAIL requests and immediately marks the page completed via the real sourceRegistry wiring (Requirement 4.2)', async () => {
    const page: HandoffPageFixture = {
      sourceUrl: 'https://www.cake.me/api/client/v1/jobs/search?page=1',
      pageIndex: 1,
      totalPages: 3,
      captureMode: 'full',
      rawResponse: buildCakeFullRawResponse({
        currentPage: 1,
        totalPages: 3,
        totalEntries: 1,
        items: [
          {
            path: 'already-known-job',
            title: 'Already Known Job',
            page: { path: 'acme-inc' },
          },
        ],
      }),
    };
    const filePath = await writeTempHandoffFile(
      buildHandoffFileJson('cake.me', [page]),
    );
    fetchPendingSourcesMock.mockResolvedValue([pendingEntryFor(page)]);
    // Every item on this page is already known -> `requestsToEnqueue` in the
    // real `ingestListPageItems` (crawl-router.ts) ends up empty ->
    // `hasNoDetailRequestsToEnqueue` is true -> `ingestCapturedListPage`
    // fires the immediate-completion branch synchronously, without waiting
    // for any DETAIL request (Requirement 4.2's only path reachable given
    // this suite's mocked no-op `PuppeteerCrawler.run()` — see header
    // comment).
    fetchExistingMock.mockResolvedValue(
      new Map([
        [
          'already-known-job',
          {
            id: 'already-known-job',
            updated_at: '2026-01-01T00:00:00.000Z',
            created_at: '2025-01-01T00:00:00.000Z',
            title: 'Already Known Job',
            description: 'x',
            location: 'Taipei',
            salary: '',
            salary_manual: false,
            closed: false,
          },
        ],
      ]),
    );

    const summary = await ingestHandoffFile(filePath, []);

    expect(allQueuedRequests()).toHaveLength(0);
    // Both assertions below flow through the REAL, unmocked
    // `@codeshore/sync-core` `createSyncRouter`'s `onListPageResolved`
    // composition (registerPendingPages-on-first-page-with-more-than-one-
    // total-page, then always markSourceStatus) -- mocked only at the
    // `persistence.ts` boundary -- proving the handoff path reuses the
    // EXACT SAME pagination-completion/registration wiring the live crawl
    // path uses (Requirement 4.2), not a parallel implementation.
    expect(registerPendingPagesMock).toHaveBeenCalledWith(
      page.sourceUrl,
      page.totalPages,
    );
    expect(markSourceStatusMock).toHaveBeenCalledWith(
      page.sourceUrl,
      page.pageIndex,
      'completed',
    );

    expect(summary.processedPages).toBe(1);
  });

  it('6. a whole-file structural error (unrecognized host) aborts before any downstream side effects', async () => {
    const filePath = await writeTempHandoffFile(
      JSON.stringify({
        host: 'not-a-real-host.example',
        pages: [],
      }),
    );

    await expect(ingestHandoffFile(filePath, [])).rejects.toThrow(
      /structural validation failed/i,
    );

    expect(fetchPendingSourcesMock).not.toHaveBeenCalled();
    expect(fetchExistingMock).not.toHaveBeenCalled();
    expect(requestQueueAddRequestsMock).not.toHaveBeenCalled();
    expect(puppeteerCrawlerMock).not.toHaveBeenCalled();
  });
});
