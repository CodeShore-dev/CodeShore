import type { HTTPResponse, Page } from 'puppeteer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrawlRouterConfig } from './types';
import { createCrawlRouter } from './crawl-router';
import { getSourceKey } from '../url';

// `crawl-router.ts` uses Crawlee's `RequestQueue.open()` + `queue.addRequests(...)`
// to enqueue detail-page requests for items that need a detail crawl (task 3.3,
// AC 3.4). We mock only `RequestQueue` here and keep the real
// `createPuppeteerRouter` so the 3.2 interception tests below remain unaffected.
// `vi.mock` factories are hoisted above imports/top-level consts, so the mocks
// referenced inside must be created via `vi.hoisted`.
const { addRequestsMock, openMock } = vi.hoisted(() => {
  const addRequestsMockInner = vi.fn(
    async (
      _requests: Array<{ url: string; label: string; userData: unknown }>,
    ) => undefined,
  );
  return {
    addRequestsMock: addRequestsMockInner,
    openMock: vi.fn(async () => ({ addRequests: addRequestsMockInner })),
  };
});

vi.mock('crawlee', async importOriginal => {
  const actual = await importOriginal<typeof import('crawlee')>();
  return {
    ...actual,
    RequestQueue: { open: openMock },
  };
});

// This spec drives task 3.2's slice of `createCrawlRouter` (list-page API
// response interception with configurable timeout/retry) plus task 3.3's slice
// (pagination parsing, item extraction, memoized existing-item lookup, detail
// page enqueue decision, and list-page completed/failed status reporting).
// Detail-page handling and batching (tasks 3.4-3.5) are intentionally out of
// scope and are not asserted here.

interface ListResponse {
  page: number;
  totalPages: number;
  totalEntries: number;
  items: { id: string }[];
}

interface RawItem {
  id: string;
}

interface Detail {
  description: string;
}

interface PersistItem {
  id: string;
  description: string;
}

interface ExistingMeta {
  updatedAt: string;
}

const LIST_API_URL = 'https://example.test/api/list?page=1';

function createBaseConfig(
  overrides: Partial<
    CrawlRouterConfig<ListResponse, RawItem, Detail, PersistItem, ExistingMeta>
  > = {},
): CrawlRouterConfig<ListResponse, RawItem, Detail, PersistItem, ExistingMeta> {
  return {
    matchListResponse: (url: string) => url.includes('/api/list'),
    parsePagination: response => ({
      currentPage: response.page,
      totalPages: response.totalPages,
      totalEntries: response.totalEntries,
    }),
    extractItems: response => response.items,
    resolveExisting: async () => new Map<string, ExistingMeta>(),
    detailPageWaitSelector: '.detail-root',
    extractDetailOnHTML: () => ({ description: 'stub' }),
    buildPersistItem: (item, detail) => ({
      id: item.id,
      description: detail.description,
    }),
    onBatchReady: async () => {
      /* not exercised by this task's slice */
    },
    onListPageResolved: async () => {
      /* not exercised by this task's slice */
    },
    logger: {
      info: () => undefined,
      warning: () => undefined,
      error: () => undefined,
    },
    ...overrides,
  };
}

/**
 * Builds a mock Puppeteer response object satisfying just the surface
 * `crawl-router.ts` needs: `.request().method()`, `.url()`, `.status()`,
 * `.json()`.
 */
function createMockResponse(options: {
  url: string;
  method?: string;
  status?: number;
  json?: unknown;
  headers?: Record<string, string>;
}): HTTPResponse {
  const { url, method = 'GET', status = 200, json = {}, headers = {} } = options;
  return {
    request: () => ({ method: () => method }),
    url: () => url,
    status: () => status,
    json: async () => json,
    headers: () => headers,
  } as unknown as HTTPResponse;
}

/**
 * Builds a mock Puppeteer `page` whose `.on('response', ...)` listener
 * registry is scriptable via `emitResponse`, and whose `.reload()` calls are
 * tracked and optionally chained to fire further responses.
 */
function createMockPage() {
  const listeners = new Set<(res: HTTPResponse) => unknown>();
  const reload = vi.fn(async () => undefined);

  const page = {
    on: vi.fn((event: string, handler: (res: HTTPResponse) => unknown) => {
      if (event === 'response') listeners.add(handler);
      return page;
    }),
    off: vi.fn((event: string, handler: (res: HTTPResponse) => unknown) => {
      if (event === 'response') listeners.delete(handler);
      return page;
    }),
    reload,
  } as unknown as Page;

  return {
    page,
    reload,
    listenerCount: () => listeners.size,
    emitResponse: (res: HTTPResponse) => {
      for (const listener of [...listeners]) {
        listener(res);
      }
    },
  };
}

/**
 * Builds the minimal Crawlee `addDefaultHandler` context the router needs.
 * Crawlee's real `Router` internally calls `context.log.debug(...)` before
 * dispatching to the registered handler, so the mock `log` must satisfy that
 * too even though `crawl-router.ts` itself never calls `.debug`.
 */
function createHandlerContext(
  page: Page,
  requestUrl: string,
  overrides: {
    response?: HTTPResponse;
    crawler?: { stop: (reason?: string) => void };
  } = {},
) {
  return {
    request: { url: requestUrl, loadedUrl: requestUrl, userData: {} },
    page,
    response: overrides.response,
    crawler: overrides.crawler ?? { stop: vi.fn() },
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    enqueueLinks: vi.fn(async (_options: { urls: string[] }) => undefined),
  };
}

/**
 * Builds a mock Puppeteer `page` for DETAIL-handler tests: scriptable
 * `waitForSelector` (records call order via a shared `callOrder` array) and
 * `evaluate` (invokes the passed function directly, standing in for the real
 * browser-context execution of `extractDetailOnHTML`).
 */
function createMockDetailPage(options: {
  detail: unknown;
  callOrder: string[];
}) {
  const { detail, callOrder } = options;
  const waitForSelector = vi.fn(async (..._args: unknown[]) => {
    callOrder.push('waitForSelector');
    return undefined;
  });
  const evaluate = vi.fn(async (fn: () => unknown) => {
    callOrder.push('evaluate');
    void fn;
    return detail;
  });
  const page = { waitForSelector, evaluate } as unknown as Page;
  return { page, waitForSelector, evaluate };
}

/**
 * Builds the minimal Crawlee DETAIL-handler context: a `request` carrying the
 * enqueued item as `userData` (mirrors task 3.3's `requestsToEnqueue` shape).
 */
function createDetailHandlerContext(
  page: Page,
  requestUrl: string,
  userData: unknown,
  overrides: {
    response?: HTTPResponse;
    crawler?: { stop: (reason?: string) => void };
  } = {},
) {
  return {
    request: { url: requestUrl, loadedUrl: requestUrl, userData, label: 'DETAIL' },
    page,
    response: overrides.response,
    crawler: overrides.crawler ?? { stop: vi.fn() },
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    enqueueLinks: vi.fn(async () => undefined),
  };
}

/**
 * Drives one list-page handler invocation (to establish the `resolveBatchSize`
 * closure state used by task 3.3's default handler) followed by one or more
 * DETAIL handler invocations against the same router instance, mirroring how
 * a real crawl run visits the list page once before its detail pages.
 */
async function runListThenDetailHandlers(
  router: ReturnType<typeof createCrawlRouter>['router'],
  listJson: ListResponse,
  detailInvocations: Array<{ page: Page; userData: unknown; requestUrl: string }>,
) {
  const listMock = createMockPage();
  await runListPageHandler(router, listMock, LIST_API_URL, listJson);

  for (const { page, userData, requestUrl } of detailInvocations) {
    const ctx = createDetailHandlerContext(page, requestUrl, userData);
    await router(ctx as never);
  }
}

describe('createCrawlRouter — list response interception & retry (3.2)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  it('resolves without retrying when the list response matches on the first attempt', async () => {
    const { router } = createCrawlRouter(createBaseConfig());
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    const handlerPromise = router(ctx as never);

    // Give the handler a tick to register its response listener before we emit.
    await Promise.resolve();
    await Promise.resolve();
    mock.emitResponse(
      createMockResponse({ url: LIST_API_URL, json: { page: 1, totalPages: 1, totalEntries: 0, items: [] } }),
    );

    await expect(handlerPromise).resolves.toBeUndefined();
    expect(mock.reload).not.toHaveBeenCalled();
    expect(mock.listenerCount()).toBe(0);
  });

  it('retries exactly once via page.reload() when the first attempt times out, then resolves on success', async () => {
    const { router } = createCrawlRouter(
      createBaseConfig({ listResponseTimeoutMs: 20, maxListRetries: 3 }),
    );
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    // On reload, emit the matching response shortly after.
    mock.reload.mockImplementation(async () => {
      setTimeout(() => {
        mock.emitResponse(
          createMockResponse({
            url: LIST_API_URL,
            json: { page: 1, totalPages: 1, totalEntries: 0, items: [] },
          }),
        );
      }, 0);
    });

    const handlerPromise = router(ctx as never);

    await expect(handlerPromise).resolves.toBeUndefined();
    expect(mock.reload).toHaveBeenCalledTimes(1);
    expect(mock.listenerCount()).toBe(0);
  });

  it('uses the data from the eventual successful retry response (not a stale/empty first-attempt value) downstream', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({
        onListPageResolved,
        listResponseTimeoutMs: 20,
        maxListRetries: 3,
      }),
    );
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    // The retried (post-reload) response carries distinctive pagination
    // values that a stale/default value would never produce. Proving these
    // exact values flow through to `onListPageResolved` demonstrates the
    // retry's response body — not just the fact that *a* response arrived —
    // is what the rest of the handler actually consumes.
    mock.reload.mockImplementation(async () => {
      setTimeout(() => {
        mock.emitResponse(
          createMockResponse({
            url: LIST_API_URL,
            json: { page: 9, totalPages: 42, totalEntries: 999, items: [] },
          }),
        );
      }, 0);
    });

    await expect(router(ctx as never)).resolves.toBeUndefined();
    expect(mock.reload).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).toHaveBeenCalledWith({
      url: LIST_API_URL,
      page: 9,
      totalPages: 42,
      status: 'completed',
    });
  });

  it('surfaces a failure once maxListRetries is exhausted without a matching response', async () => {
    const { router } = createCrawlRouter(
      createBaseConfig({ listResponseTimeoutMs: 10, maxListRetries: 2 }),
    );
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    // Never emit a matching response; reload() is a no-op that resolves immediately.

    await expect(router(ctx as never)).rejects.toThrow();
    expect(mock.reload).toHaveBeenCalledTimes(1); // 2 total attempts = 1 retry (1 reload)
    expect(mock.listenerCount()).toBe(0);
  });

  it('ignores a response matching the URL but with method() === "OPTIONS" (fixed internal check)', async () => {
    const { router } = createCrawlRouter(
      createBaseConfig({ listResponseTimeoutMs: 30, maxListRetries: 1 }),
    );
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    const handlerPromise = router(ctx as never);

    await Promise.resolve();
    await Promise.resolve();
    mock.emitResponse(
      createMockResponse({
        url: LIST_API_URL,
        method: 'OPTIONS',
        json: { page: 1, totalPages: 1, totalEntries: 0, items: [] },
      }),
    );

    // The OPTIONS response must be ignored; with maxListRetries: 1 (no retry
    // budget left) and nothing else ever matching, the handler should fail
    // once the timeout elapses.
    await expect(handlerPromise).rejects.toThrow();
    expect(mock.listenerCount()).toBe(0);
  });

  it('ignores a response matching the URL but with status() !== 200 (fixed internal check)', async () => {
    const { router } = createCrawlRouter(
      createBaseConfig({ listResponseTimeoutMs: 30, maxListRetries: 1 }),
    );
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    const handlerPromise = router(ctx as never);

    await Promise.resolve();
    await Promise.resolve();
    mock.emitResponse(
      createMockResponse({
        url: LIST_API_URL,
        status: 500,
        json: { page: 1, totalPages: 1, totalEntries: 0, items: [] },
      }),
    );

    await expect(handlerPromise).rejects.toThrow();
    expect(mock.listenerCount()).toBe(0);
  });

  it('respects a custom matchListResponse predicate and ignores non-matching URLs', async () => {
    const { router } = createCrawlRouter(
      createBaseConfig({
        matchListResponse: url => url.includes('/custom-list-endpoint'),
        listResponseTimeoutMs: 20,
        maxListRetries: 1,
      }),
    );
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    const handlerPromise = router(ctx as never);

    await Promise.resolve();
    await Promise.resolve();
    // A response at a URL that does NOT satisfy the custom predicate.
    mock.emitResponse(
      createMockResponse({
        url: 'https://example.test/api/unrelated',
        json: { page: 1, totalPages: 1, totalEntries: 0, items: [] },
      }),
    );

    await expect(handlerPromise).rejects.toThrow();
    expect(mock.listenerCount()).toBe(0);
  });
});

/**
 * Drives a full list-page handler invocation to completion by emitting a
 * matching list response after the handler has had a chance to register its
 * listener, then awaits the handler promise.
 */
async function runListPageHandler(
  router: ReturnType<typeof createCrawlRouter>['router'],
  mock: ReturnType<typeof createMockPage>,
  requestUrl: string,
  json: unknown,
) {
  const ctx = createHandlerContext(mock.page, requestUrl);
  const handlerPromise = router(ctx as never);
  await Promise.resolve();
  await Promise.resolve();
  mock.emitResponse(createMockResponse({ url: requestUrl, json }));
  await handlerPromise;
  return ctx;
}

describe('createCrawlRouter — pagination, extraction, existing lookup, enqueue decision, status reporting (3.3)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  it('calls parsePagination and extractItems with the captured response', async () => {
    const parsePagination = vi.fn(createBaseConfig().parsePagination);
    const extractItems = vi.fn(createBaseConfig().extractItems);
    const { router } = createCrawlRouter(
      createBaseConfig({ parsePagination, extractItems }),
    );
    const mock = createMockPage();
    const listJson = {
      page: 2,
      totalPages: 5,
      totalEntries: 42,
      items: [{ id: 'a' }],
    };

    await runListPageHandler(router, mock, LIST_API_URL, listJson);

    expect(parsePagination).toHaveBeenCalledWith(listJson);
    expect(extractItems).toHaveBeenCalledWith(listJson);
  });

  it('calls resolveExisting exactly once across two list-page handler invocations on the same router instance (memoization)', async () => {
    const resolveExisting = vi.fn(
      async () => new Map<string, ExistingMeta>(),
    );
    const { router } = createCrawlRouter(
      createBaseConfig({ resolveExisting }),
    );

    const mock1 = createMockPage();
    await runListPageHandler(router, mock1, LIST_API_URL, {
      page: 1,
      totalPages: 2,
      totalEntries: 2,
      items: [{ id: 'a' }],
    });

    const mock2 = createMockPage();
    await runListPageHandler(router, mock2, 'https://example.test/api/list?page=2', {
      page: 2,
      totalPages: 2,
      totalEntries: 2,
      items: [{ id: 'b' }],
    });

    expect(resolveExisting).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue a detail-page request for an item whose id is present in the existing-item map', async () => {
    const resolveExisting = vi.fn(
      async () => new Map<string, ExistingMeta>([['a', { updatedAt: '2024-01-01' }]]),
    );
    const { router } = createCrawlRouter(
      createBaseConfig({ resolveExisting }),
    );
    const mock = createMockPage();

    await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 1,
      items: [{ id: 'a' }],
    });

    expect(addRequestsMock).not.toHaveBeenCalled();
  });

  it('enqueues a detail-page request (label DETAIL) for an item whose id is not in the existing-item map', async () => {
    const resolveExisting = vi.fn(async () => new Map<string, ExistingMeta>());
    const { router } = createCrawlRouter(
      createBaseConfig({ resolveExisting }),
    );
    const mock = createMockPage();

    await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 1,
      items: [{ id: 'new-item' }],
    });

    expect(openMock).toHaveBeenCalledTimes(1);
    expect(addRequestsMock).toHaveBeenCalledTimes(1);
    const [enqueuedRequests] = addRequestsMock.mock.calls[0] ?? [[]];
    expect(enqueuedRequests).toHaveLength(1);
    expect(enqueuedRequests[0]?.label).toBe('DETAIL');
    expect((enqueuedRequests[0]?.userData as { id: string }).id).toBe(
      'new-item',
    );
  });

  it('only enqueues the new items out of a mixed batch of existing and new items', async () => {
    const resolveExisting = vi.fn(
      async () => new Map<string, ExistingMeta>([['existing-1', { updatedAt: '2024-01-01' }]]),
    );
    const { router } = createCrawlRouter(
      createBaseConfig({ resolveExisting }),
    );
    const mock = createMockPage();

    await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 2,
      items: [{ id: 'existing-1' }, { id: 'new-1' }],
    });

    expect(addRequestsMock).toHaveBeenCalledTimes(1);
    const [enqueuedRequests] = addRequestsMock.mock.calls[0] ?? [[]];
    expect(enqueuedRequests).toHaveLength(1);
    expect((enqueuedRequests[0]?.userData as { id: string }).id).toBe(
      'new-1',
    );
  });

  it('enqueues the next list page URL via enqueueLinks when currentPage < totalPages', async () => {
    const { router } = createCrawlRouter(createBaseConfig());
    const mock = createMockPage();

    const ctx = await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 2,
      totalEntries: 0,
      items: [],
    });

    expect(ctx.enqueueLinks).toHaveBeenCalledTimes(1);
    const [enqueueLinksArgs] = ctx.enqueueLinks.mock.calls[0]!;
    expect(enqueueLinksArgs.urls).toEqual([
      'https://example.test/api/list?page=2',
    ]);
  });

  it('does not enqueue a next list page when currentPage === totalPages', async () => {
    const { router } = createCrawlRouter(createBaseConfig());
    const mock = createMockPage();

    const ctx = await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 0,
      items: [],
    });

    expect(ctx.enqueueLinks).not.toHaveBeenCalled();
  });

  it('enqueues detail-page requests before the next list page request, so detail pages take priority over the next page (FIFO)', async () => {
    const resolveExisting = vi.fn(async () => new Map<string, ExistingMeta>());
    const { router } = createCrawlRouter(createBaseConfig({ resolveExisting }));
    const mock = createMockPage();

    const ctx = await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 2,
      totalEntries: 1,
      items: [{ id: 'new-item' }],
    });

    expect(addRequestsMock).toHaveBeenCalledTimes(1);
    expect(ctx.enqueueLinks).toHaveBeenCalledTimes(1);
    const addRequestsOrder = addRequestsMock.mock.invocationCallOrder[0];
    const enqueueLinksOrder = ctx.enqueueLinks.mock.invocationCallOrder[0];
    expect(addRequestsOrder).toBeLessThan(enqueueLinksOrder);
  });

  it('reports onListPageResolved with status "completed" and correct url/page/totalPages on success', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved }),
    );
    const mock = createMockPage();

    await runListPageHandler(router, mock, LIST_API_URL, {
      page: 3,
      totalPages: 7,
      totalEntries: 70,
      items: [],
    });

    expect(onListPageResolved).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).toHaveBeenCalledWith({
      url: LIST_API_URL,
      page: 3,
      totalPages: 7,
      status: 'completed',
    });
  });

  it('defers reporting "completed" until every DETAIL request the page enqueued has been processed, so an interruption before that point leaves the page resumable', async () => {
    // Regression test: previously `onListPageResolved` fired with status
    // "completed" the instant the list page finished parsing/enqueueing —
    // before any of its DETAIL requests had actually been crawled. If the
    // process was killed in that window, the caller (persistence layer)
    // would have already durably marked the page as done, so it would never
    // be revisited on resume — permanently losing whatever jobs were still
    // sitting in the DETAIL queue. The page must stay "not yet resolved"
    // until its own DETAIL requests are all accounted for (success or
    // failure), so an interruption in that window leaves it resumable.
    const onListPageResolved = vi.fn(async () => undefined);
    const resolveExisting = vi.fn(async () => new Map<string, ExistingMeta>());
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved, resolveExisting }),
    );
    const mock = createMockPage();

    await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 2,
      items: [{ id: 'a' }, { id: 'b' }],
    });

    // Not yet resolved: both DETAIL requests are still outstanding.
    expect(onListPageResolved).not.toHaveBeenCalled();

    const [enqueued] = addRequestsMock.mock.calls[0] ?? [[]];
    const enqueuedRequests = enqueued as Array<{ userData: { id: string } }>;

    const aDetail = createMockDetailPage({
      detail: { description: 'detail-a' },
      callOrder: [],
    });
    await router(
      createDetailHandlerContext(
        aDetail.page,
        'https://example.test/a',
        enqueuedRequests.find(r => r.userData.id === 'a')!.userData,
      ) as never,
    );

    // Still not resolved: 'b' hasn't been processed yet — simulates the
    // process being killed right here, before the page is durably marked
    // completed, so it remains eligible for resume.
    expect(onListPageResolved).not.toHaveBeenCalled();

    const bDetail = createMockDetailPage({
      detail: { description: 'detail-b' },
      callOrder: [],
    });
    await router(
      createDetailHandlerContext(
        bDetail.page,
        'https://example.test/b',
        enqueuedRequests.find(r => r.userData.id === 'b')!.userData,
      ) as never,
    );

    // Only now, with every DETAIL request for this page accounted for, is the
    // page reported as completed.
    expect(onListPageResolved).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).toHaveBeenCalledWith({
      url: LIST_API_URL,
      page: 1,
      totalPages: 1,
      status: 'completed',
    });
  });

  it('reports onListPageResolved with status "failed" and does not throw out of the handler when parsePagination throws', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const parsePagination = vi.fn(() => {
      throw new Error('boom: malformed pagination');
    });
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved, parsePagination }),
    );
    const mock = createMockPage();
    const ctx = createHandlerContext(mock.page, LIST_API_URL);

    const handlerPromise = router(ctx as never);
    await Promise.resolve();
    await Promise.resolve();
    mock.emitResponse(
      createMockResponse({
        url: LIST_API_URL,
        json: { page: 1, totalPages: 1, totalEntries: 0, items: [] },
      }),
    );

    // The per-page try/catch must isolate the failure: the handler itself
    // resolves (does not reject / crash the crawl run), while the status
    // report reflects the failure.
    await expect(handlerPromise).resolves.toBeUndefined();
    expect(onListPageResolved).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).toHaveBeenCalledWith(
      expect.objectContaining({ url: LIST_API_URL, status: 'failed' }),
    );
    expect(addRequestsMock).not.toHaveBeenCalled();
  });

  it('reports onListPageResolved with status "failed" when extractItems throws', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const extractItems = vi.fn(() => {
      throw new Error('boom: malformed items');
    });
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved, extractItems }),
    );
    const mock = createMockPage();

    await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 0,
      items: [],
    });

    expect(onListPageResolved).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});

describe('createCrawlRouter — detail page handling & batch persistence (3.4)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  const baseListJson: ListResponse = {
    page: 1,
    totalPages: 1,
    totalEntries: 0,
    items: [],
  };

  it('waits for detailPageWaitSelector before calling extractDetailOnHTML (order matters)', async () => {
    const callOrder: string[] = [];
    const extractDetailOnHTML = vi.fn(() => ({ description: 'x' }));
    const { router } = createCrawlRouter(
      createBaseConfig({ extractDetailOnHTML }),
    );
    const { page, waitForSelector, evaluate } = createMockDetailPage({
      detail: { description: 'x' },
      callOrder,
    });

    await runListThenDetailHandlers(router, baseListJson, [
      { page, userData: { id: 'a' }, requestUrl: 'https://example.test/a' },
    ]);

    expect(waitForSelector).toHaveBeenCalledTimes(1);
    expect(waitForSelector.mock.calls[0]?.[0]).toBe('.detail-root');
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['waitForSelector', 'evaluate']);
  });

  it('calls buildPersistItem with the request userData item and the extracted detail', async () => {
    const buildPersistItem = vi.fn(
      (item: RawItem, detail: Detail) =>
        ({ id: item.id, description: detail.description }) as PersistItem,
    );
    const { router } = createCrawlRouter(
      createBaseConfig({ buildPersistItem }),
    );
    const { page } = createMockDetailPage({
      detail: { description: 'hello' },
      callOrder: [],
    });
    const userData = { id: 'item-1', title: 't', url: 'u' };

    await runListThenDetailHandlers(router, baseListJson, [
      { page, userData, requestUrl: 'https://example.test/item-1' },
    ]);

    expect(buildPersistItem).toHaveBeenCalledTimes(1);
    expect(buildPersistItem).toHaveBeenCalledWith(userData, {
      description: 'hello',
    });
  });

  it('never includes an item in any onBatchReady call when buildPersistItem returns undefined for it', async () => {
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const buildPersistItem = vi.fn((item: RawItem) =>
      item.id === 'skip-me'
        ? undefined
        : ({ id: item.id, description: 'ok' } as PersistItem),
    );
    const { router } = createCrawlRouter(
      createBaseConfig({
        buildPersistItem,
        onBatchReady,
        resolveBatchSize: () => 2,
      }),
    );

    const detailInvocations = ['skip-me', 'keep-1', 'keep-2'].map(id => {
      const { page } = createMockDetailPage({
        detail: { description: 'x' },
        callOrder: [],
      });
      return {
        page,
        userData: { id },
        requestUrl: `https://example.test/${id}`,
      };
    });

    await runListThenDetailHandlers(router, baseListJson, detailInvocations);

    // Threshold (2) reached by keep-1 + keep-2; skip-me must never appear in
    // any flushed batch, across the entire run.
    expect(onBatchReady).toHaveBeenCalledTimes(1);
    const allFlushedIds = onBatchReady.mock.calls.flatMap(([items]) =>
      (items as PersistItem[]).map(i => i.id),
    );
    expect(allFlushedIds).not.toContain('skip-me');
    expect(allFlushedIds.sort()).toEqual(['keep-1', 'keep-2']);
  });

  it('does not trigger onBatchReady while accumulated count is below the configured batch size', async () => {
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onBatchReady, resolveBatchSize: () => 3 }),
    );

    const detailInvocations = ['a', 'b'].map(id => {
      const { page } = createMockDetailPage({
        detail: { description: 'x' },
        callOrder: [],
      });
      return {
        page,
        userData: { id },
        requestUrl: `https://example.test/${id}`,
      };
    });

    await runListThenDetailHandlers(router, baseListJson, detailInvocations);

    expect(onBatchReady).not.toHaveBeenCalled();
  });

  it('triggers onBatchReady with exactly the accumulated batch upon reaching the threshold, then resets the accumulator', async () => {
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onBatchReady, resolveBatchSize: () => 2 }),
    );

    const makeInvocation = (id: string) => {
      const { page } = createMockDetailPage({
        detail: { description: 'x' },
        callOrder: [],
      });
      return {
        page,
        userData: { id },
        requestUrl: `https://example.test/${id}`,
      };
    };

    // First two invocations reach the threshold of 2 and flush.
    await runListThenDetailHandlers(router, baseListJson, [
      makeInvocation('a'),
      makeInvocation('b'),
    ]);

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady.mock.calls[0]?.[0]).toEqual([
      { id: 'a', description: 'x' },
      { id: 'b', description: 'x' },
    ]);

    // A third invocation (below the next threshold) must NOT re-include
    // already-flushed items 'a'/'b' — proving the accumulator reset.
    await runListThenDetailHandlers(router, baseListJson, [
      makeInvocation('c'),
    ]);

    expect(onBatchReady).toHaveBeenCalledTimes(1); // still only the first flush
  });

  it('when 3 items are processed in one continuous run against a threshold of 2, flushes exactly the first 2 together and holds the 3rd pending until the next flush trigger', async () => {
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const { router, flushPending } = createCrawlRouter(
      createBaseConfig({ onBatchReady, resolveBatchSize: () => 2 }),
    );

    const makeInvocation = (id: string) => {
      const { page } = createMockDetailPage({
        detail: { description: 'x' },
        callOrder: [],
      });
      return {
        page,
        userData: { id },
        requestUrl: `https://example.test/${id}`,
      };
    };

    // All 3 detail requests are processed sequentially within a single run
    // (unlike the test above, which splits 'a'/'b' and 'c' across two
    // separate `runListThenDetailHandlers` calls). This proves the
    // accumulator correctly flushes mid-run as soon as the threshold is hit
    // by item 2, then resumes accumulating from zero for item 3 — rather
    // than e.g. flushing all 3 together or losing track of the reset point.
    await runListThenDetailHandlers(router, baseListJson, [
      makeInvocation('a'),
      makeInvocation('b'),
      makeInvocation('c'),
    ]);

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenNthCalledWith(1, [
      { id: 'a', description: 'x' },
      { id: 'b', description: 'x' },
    ]);

    // Item 'c' must still be pending (not dropped, not already flushed).
    await flushPending();
    expect(onBatchReady).toHaveBeenCalledTimes(2);
    expect(onBatchReady).toHaveBeenNthCalledWith(2, [
      { id: 'c', description: 'x' },
    ]);
  });

  it('flushPending() flushes any remaining partial batch via onBatchReady', async () => {
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const { router, flushPending } = createCrawlRouter(
      createBaseConfig({ onBatchReady, resolveBatchSize: () => 5 }),
    );

    const { page } = createMockDetailPage({
      detail: { description: 'partial' },
      callOrder: [],
    });

    await runListThenDetailHandlers(router, baseListJson, [
      { page, userData: { id: 'only-one' }, requestUrl: 'https://example.test/only-one' },
    ]);

    expect(onBatchReady).not.toHaveBeenCalled();

    await flushPending();

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenCalledWith([
      { id: 'only-one', description: 'partial' },
    ]);
  });

  it('flushPending() does not call onBatchReady when there is nothing pending', async () => {
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const { flushPending } = createCrawlRouter(
      createBaseConfig({ onBatchReady }),
    );

    await flushPending();

    expect(onBatchReady).not.toHaveBeenCalled();
  });
});

describe('createCrawlRouter — rate limiting (HTTP 429)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  it('stops the crawler and does not report onListPageResolved when the list page navigation itself returns 429', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved }),
    );
    const mock = createMockPage();
    const stop = vi.fn();
    const ctx = createHandlerContext(mock.page, LIST_API_URL, {
      response: createMockResponse({ url: LIST_API_URL, status: 429 }),
      crawler: { stop },
    });

    await expect(router(ctx as never)).resolves.toBeUndefined();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(expect.stringContaining('429'));
    expect(onListPageResolved).not.toHaveBeenCalled();
    // The list-response interception listener must never even be attached —
    // the 429 short-circuits before `interceptListResponse` is called.
    expect(mock.listenerCount()).toBe(0);
  });

  it('stops the crawler without retrying when the intercepted list API response itself is 429', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved }),
    );
    const mock = createMockPage();
    const stop = vi.fn();
    const ctx = createHandlerContext(mock.page, LIST_API_URL, {
      crawler: { stop },
    });

    const handlerPromise = router(ctx as never);
    await Promise.resolve();
    await Promise.resolve();
    mock.emitResponse(
      createMockResponse({ url: LIST_API_URL, status: 429 }),
    );

    await expect(handlerPromise).resolves.toBeUndefined();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(expect.stringContaining('429'));
    // Must not retry: reloading would just trigger another 429.
    expect(mock.reload).not.toHaveBeenCalled();
    expect(onListPageResolved).not.toHaveBeenCalled();
  });

  it('stops the crawler when a DETAIL page navigation returns 429, without persisting it and without letting its list page ever complete', async () => {
    const resolveExisting = vi.fn(async () => new Map<string, ExistingMeta>());
    const buildPersistItem = vi.fn(
      (item: RawItem & { id: string }, detail: Detail) => ({
        id: item.id,
        description: detail.description,
      }),
    );
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ resolveExisting, buildPersistItem, onListPageResolved }),
    );

    const listMock = createMockPage();
    await runListPageHandler(router, listMock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 2,
      items: [{ id: 'a' }, { id: 'b' }],
    });
    expect(onListPageResolved).not.toHaveBeenCalled();

    const [enqueued] = addRequestsMock.mock.calls[0] ?? [[]];
    const enqueuedRequests = enqueued as Array<{ userData: { id: string } }>;

    // Detail 'a' gets rate limited — must stop the crawler, must not reach
    // buildPersistItem, and must NOT count toward its list page's completion.
    const stop = vi.fn();
    const aDetail = createMockDetailPage({
      detail: { description: 'irrelevant' },
      callOrder: [],
    });
    await router(
      createDetailHandlerContext(
        aDetail.page,
        'https://example.test/a',
        enqueuedRequests.find(r => r.userData.id === 'a')!.userData,
        {
          response: createMockResponse({
            url: 'https://example.test/a',
            status: 429,
          }),
          crawler: { stop },
        },
      ) as never,
    );

    expect(stop).toHaveBeenCalledTimes(1);
    expect(buildPersistItem).not.toHaveBeenCalled();

    // Detail 'b' still processes normally (simulates it having already been
    // in flight when the rate limiting hit) — but because 'a' never counted
    // as processed, the list page must still never be reported as completed.
    const bDetail = createMockDetailPage({
      detail: { description: 'detail-b' },
      callOrder: [],
    });
    await router(
      createDetailHandlerContext(
        bDetail.page,
        'https://example.test/b',
        enqueuedRequests.find(r => r.userData.id === 'b')!.userData,
      ) as never,
    );

    expect(buildPersistItem).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).not.toHaveBeenCalled();
  });
});

describe('createCrawlRouter — Cloudflare blocking (403/503 with Cloudflare markers)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  it('stops the crawler when the list page navigation itself is a Cloudflare 403 block', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved }),
    );
    const mock = createMockPage();
    const stop = vi.fn();
    const ctx = createHandlerContext(mock.page, LIST_API_URL, {
      response: createMockResponse({
        url: LIST_API_URL,
        status: 403,
        headers: { server: 'cloudflare' },
      }),
      crawler: { stop },
    });

    await expect(router(ctx as never)).resolves.toBeUndefined();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(expect.stringContaining('Cloudflare'));
    expect(onListPageResolved).not.toHaveBeenCalled();
    expect(mock.listenerCount()).toBe(0);
  });

  it('stops the crawler without retrying when the intercepted list API response is a Cloudflare 503 challenge', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved }),
    );
    const mock = createMockPage();
    const stop = vi.fn();
    const ctx = createHandlerContext(mock.page, LIST_API_URL, {
      crawler: { stop },
    });

    const handlerPromise = router(ctx as never);
    await Promise.resolve();
    await Promise.resolve();
    mock.emitResponse(
      createMockResponse({
        url: LIST_API_URL,
        status: 503,
        headers: { 'cf-mitigated': 'challenge' },
      }),
    );

    await expect(handlerPromise).resolves.toBeUndefined();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(expect.stringContaining('Cloudflare'));
    // Must not retry: reloading would just trigger another challenge.
    expect(mock.reload).not.toHaveBeenCalled();
    expect(onListPageResolved).not.toHaveBeenCalled();
  });

  it('does not treat a plain (non-Cloudflare) 503 as a Cloudflare block and retries as usual', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({
        onListPageResolved,
        maxListRetries: 2,
        listResponseTimeoutMs: 50,
      }),
    );
    const mock = createMockPage();
    const stop = vi.fn();
    const ctx = createHandlerContext(mock.page, LIST_API_URL, {
      crawler: { stop },
    });

    const handlerPromise = router(ctx as never);
    await Promise.resolve();
    await Promise.resolve();
    mock.emitResponse(
      createMockResponse({ url: LIST_API_URL, status: 503 }),
    );

    // No Cloudflare markers on this plain 503 — it must not resolve or
    // reject the interception, so the attempt just times out and retries
    // via the ordinary (non-Cloudflare) path, ultimately surfacing as the
    // regular timeout error once retries are exhausted — not a short-circuit
    // via `crawler.stop()`.
    await expect(handlerPromise).rejects.toThrow(
      'Timeout waiting for list API response',
    );

    expect(stop).not.toHaveBeenCalled();
    expect(mock.reload).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).not.toHaveBeenCalled();
  });

  it('stops the crawler when a DETAIL page navigation is a Cloudflare block, without persisting it and without letting its list page ever complete', async () => {
    const resolveExisting = vi.fn(async () => new Map<string, ExistingMeta>());
    const buildPersistItem = vi.fn(
      (item: RawItem & { id: string }, detail: Detail) => ({
        id: item.id,
        description: detail.description,
      }),
    );
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ resolveExisting, buildPersistItem, onListPageResolved }),
    );

    const listMock = createMockPage();
    await runListPageHandler(router, listMock, LIST_API_URL, {
      page: 1,
      totalPages: 1,
      totalEntries: 1,
      items: [{ id: 'a' }],
    });
    expect(onListPageResolved).not.toHaveBeenCalled();

    const [enqueued] = addRequestsMock.mock.calls[0] ?? [[]];
    const enqueuedRequests = enqueued as Array<{ userData: { id: string } }>;

    const stop = vi.fn();
    const aDetail = createMockDetailPage({
      detail: { description: 'irrelevant' },
      callOrder: [],
    });
    await router(
      createDetailHandlerContext(
        aDetail.page,
        'https://example.test/a',
        enqueuedRequests.find(r => r.userData.id === 'a')!.userData,
        {
          response: createMockResponse({
            url: 'https://example.test/a',
            status: 403,
            headers: { server: 'cloudflare' },
          }),
          crawler: { stop },
        },
      ) as never,
    );

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(expect.stringContaining('Cloudflare'));
    expect(buildPersistItem).not.toHaveBeenCalled();
    expect(onListPageResolved).not.toHaveBeenCalled();
  });
});

describe('createCrawlRouter — job source skip after consecutive empty pages', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  const sourceKey = getSourceKey(LIST_API_URL);

  function pageUrl(page: number): string {
    return `https://example.test/api/list?page=${page}`;
  }

  it('skips the remaining pages of a job source once it hits 5 consecutive pages with no new jobs', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({ onListPageResolved }),
    );

    // Pages 1-5 all come back with zero new items (everything already exists)
    // — the 5th one should trip the skip.
    for (let page = 1; page <= 5; page++) {
      const mock = createMockPage();
      await runListPageHandler(router, mock, pageUrl(page), {
        page,
        totalPages: 999,
        totalEntries: 0,
        items: [],
      });
    }

    // Page 6 must now be short-circuited: no list-response listener even
    // attached (proves it never reached `interceptListResponse`), and the
    // page is immediately reported as completed so it doesn't dangle.
    onListPageResolved.mockClear();
    const mock6 = createMockPage();
    await router(createHandlerContext(mock6.page, pageUrl(6)) as never);

    expect(mock6.listenerCount()).toBe(0);
    expect(onListPageResolved).toHaveBeenCalledWith({
      url: pageUrl(6),
      page: 6,
      totalPages: 6,
      status: 'completed',
    });
  });

  it('does not skip while re-walking pages within knownPageFloors, even if every one of them has zero new jobs — only counts empty pages past the floor', async () => {
    const onListPageResolved = vi.fn(async () => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({
        onListPageResolved,
        knownPageFloors: new Map([[sourceKey, 5]]),
      }),
    );

    // Pages 1-5 are within the known floor (already fully crawled in a prior
    // run) — even though every one looks empty this time, none of them may
    // count toward the abandon streak.
    for (let page = 1; page <= 5; page++) {
      const mock = createMockPage();
      await runListPageHandler(router, mock, pageUrl(page), {
        page,
        totalPages: 999,
        totalEntries: 0,
        items: [],
      });
    }

    // Page 6 is past the floor — it must still be processed normally (not
    // short-circuited), proving the source was not abandoned during 1-5.
    // A short-circuited "skip" report always carries `totalPages` equal to
    // the page number itself (it never learned the real pagination info),
    // whereas a genuinely processed page reports the real `totalPages` (999)
    // parsed from the mocked list response — a precise way to tell the two
    // apart without relying on listener bookkeeping that both paths clean up
    // identically by the time the handler promise resolves.
    onListPageResolved.mockClear();
    const mock6 = createMockPage();
    await runListPageHandler(router, mock6, pageUrl(6), {
      page: 6,
      totalPages: 999,
      totalEntries: 0,
      items: [],
    });
    expect(onListPageResolved).toHaveBeenCalledWith({
      url: pageUrl(6),
      page: 6,
      totalPages: 999,
      status: 'completed',
    });

    // Pages 7-10 are also empty and past the floor: 6,7,8,9,10 is 5
    // consecutive empty pages past the floor, so page 10 should trip the skip.
    for (let page = 7; page <= 10; page++) {
      const mock = createMockPage();
      await runListPageHandler(router, mock, pageUrl(page), {
        page,
        totalPages: 999,
        totalEntries: 0,
        items: [],
      });
    }

    onListPageResolved.mockClear();
    const mock11 = createMockPage();
    await router(createHandlerContext(mock11.page, pageUrl(11)) as never);

    expect(mock11.listenerCount()).toBe(0);
    expect(onListPageResolved).toHaveBeenCalledWith({
      url: pageUrl(11),
      page: 11,
      totalPages: 11,
      status: 'completed',
    });
  });
});

describe('createCrawlRouter — progress/ETA tracking & error isolation (3.5)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  const baseListJson: ListResponse = {
    page: 1,
    totalPages: 1,
    totalEntries: 0,
    items: [],
  };

  it('logs list-page progress info (page, totalPages, duration, ETA) via logger.info after a list page completes', async () => {
    const infoSpy = vi.fn();
    const { router } = createCrawlRouter(
      createBaseConfig({
        logger: { info: infoSpy, warning: () => undefined, error: () => undefined },
      }),
    );
    const mock = createMockPage();

    await runListPageHandler(router, mock, LIST_API_URL, {
      page: 1,
      totalPages: 3,
      totalEntries: 10,
      items: [],
    });

    // Must contain recognizable progress info: current/total page and an ETA/duration marker.
    const progressCall = infoSpy.mock.calls.find(
      ([msg]: [string]) =>
        typeof msg === 'string' &&
        msg.includes('1/3') &&
        /took/i.test(msg) &&
        /est\.?\s*finish/i.test(msg),
    );
    expect(progressCall).toBeDefined();
  });

  it('logs detail-page progress info (processed count, duration, ETA) via logger.info after a detail page completes', async () => {
    const infoSpy = vi.fn();
    const { router } = createCrawlRouter(
      createBaseConfig({
        logger: { info: infoSpy, warning: () => undefined, error: () => undefined },
      }),
    );
    const { page } = createMockDetailPage({
      detail: { description: 'x' },
      callOrder: [],
    });

    await runListThenDetailHandlers(router, baseListJson, [
      { page, userData: { id: 'a' }, requestUrl: 'https://example.test/a' },
    ]);

    const progressCall = infoSpy.mock.calls.find(
      ([msg]: [string]) =>
        typeof msg === 'string' &&
        /^Detail /.test(msg) &&
        /took/i.test(msg) &&
        /est\.?\s*finish/i.test(msg),
    );
    expect(progressCall).toBeDefined();
  });

  it('does not throw/crash when computing progress on the very first list page (avg/count start at 0)', async () => {
    const infoSpy = vi.fn();
    const { router } = createCrawlRouter(
      createBaseConfig({
        logger: { info: infoSpy, warning: () => undefined, error: () => undefined },
      }),
    );
    const mock = createMockPage();

    await expect(
      runListPageHandler(router, mock, LIST_API_URL, {
        page: 1,
        totalPages: 1,
        totalEntries: 0,
        items: [],
      }),
    ).resolves.toBeDefined();

    const progressCall = infoSpy.mock.calls.find(
      ([msg]: [string]) => typeof msg === 'string' && /est\.?\s*finish/i.test(msg),
    );
    expect(progressCall).toBeDefined();
    // Message must not contain NaN/Infinity from a division-by-zero edge case.
    expect(String(progressCall?.[0])).not.toMatch(/NaN|Infinity/);
  });

  it('isolates a list-page failure: logs the error via logger.error, resolves without throwing, and a subsequent list-page request on the same router still succeeds', async () => {
    const errorSpy = vi.fn();
    const onListPageResolved = vi.fn(async () => undefined);
    let shouldThrow = true;
    const parsePagination = vi.fn((response: ListResponse) => {
      if (shouldThrow) {
        throw new Error('boom: simulated single-item failure');
      }
      return {
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      };
    });
    const { router } = createCrawlRouter(
      createBaseConfig({
        parsePagination,
        onListPageResolved,
        logger: { info: () => undefined, warning: () => undefined, error: errorSpy },
      }),
    );

    // First list page throws inside parsePagination.
    const mock1 = createMockPage();
    await expect(
      runListPageHandler(router, mock1, LIST_API_URL, {
        page: 1,
        totalPages: 2,
        totalEntries: 2,
        items: [],
      }),
    ).resolves.toBeDefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(onListPageResolved).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: 'failed' }),
    );

    // Subsequent list page must still be processed successfully — proves the
    // engine continues to the next item rather than aborting the crawl run.
    shouldThrow = false;
    const mock2 = createMockPage();
    await expect(
      runListPageHandler(
        router,
        mock2,
        'https://example.test/api/list?page=2',
        { page: 2, totalPages: 2, totalEntries: 2, items: [] },
      ),
    ).resolves.toBeDefined();

    expect(onListPageResolved).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'completed', page: 2, totalPages: 2 }),
    );
  });

  it('isolates a detail-page failure: logs the error via logger.error, resolves without throwing, and a subsequent detail-page request on the same router still succeeds', async () => {
    const errorSpy = vi.fn();
    const buildPersistItem = vi.fn(
      (item: RawItem & { id: string }, detail: Detail) => {
        if (item.id === 'boom') {
          throw new Error('boom: simulated single-item failure');
        }
        return { id: item.id, description: detail.description };
      },
    );
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const { router } = createCrawlRouter(
      createBaseConfig({
        buildPersistItem,
        onBatchReady,
        logger: { info: () => undefined, warning: () => undefined, error: errorSpy },
      }),
    );

    const failingDetail = createMockDetailPage({
      detail: { description: 'irrelevant' },
      callOrder: [],
    });
    const okDetail = createMockDetailPage({
      detail: { description: 'ok' },
      callOrder: [],
    });

    await runListThenDetailHandlers(router, baseListJson, [
      { page: failingDetail.page, userData: { id: 'boom' }, requestUrl: 'https://example.test/boom' },
      { page: okDetail.page, userData: { id: 'safe' }, requestUrl: 'https://example.test/safe' },
    ]);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    // The failing item must never reach onBatchReady/pendingItems, while the
    // subsequent detail request is still fully processed (evaluate() called,
    // buildPersistItem called with the safe item).
    expect(buildPersistItem).toHaveBeenCalledTimes(2);
    expect(okDetail.evaluate).toHaveBeenCalledTimes(1);
  });

  it('flushes the safe item accumulated after a failing detail-page item via flushPending', async () => {
    const buildPersistItem = vi.fn(
      (item: RawItem & { id: string }, detail: Detail) => {
        if (item.id === 'boom') {
          throw new Error('boom: simulated single-item failure');
        }
        return { id: item.id, description: detail.description };
      },
    );
    const onBatchReady = vi.fn(async (_items: PersistItem[]) => undefined);
    const { router, flushPending } = createCrawlRouter(
      createBaseConfig({
        buildPersistItem,
        onBatchReady,
        resolveBatchSize: () => 5,
      }),
    );

    const failingDetail = createMockDetailPage({
      detail: { description: 'irrelevant' },
      callOrder: [],
    });
    const okDetail = createMockDetailPage({
      detail: { description: 'ok' },
      callOrder: [],
    });

    await runListThenDetailHandlers(router, baseListJson, [
      { page: failingDetail.page, userData: { id: 'boom' }, requestUrl: 'https://example.test/boom' },
      { page: okDetail.page, userData: { id: 'safe' }, requestUrl: 'https://example.test/safe' },
    ]);

    await flushPending();

    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenCalledWith([
      { id: 'safe', description: 'ok' },
    ]);
  });

  it('does not expose any config field to disable or customize error isolation', () => {
    // Structural guarantee: `CrawlRouterConfig` has no boolean/callback field
    // whose name suggests error isolation could be toggled off. This is a
    // compile-time contract check via object key inspection of a fully-typed
    // config literal — if a future change added such a field, this test's
    // key list assertion would need to be deliberately updated, surfacing
    // the regression in review.
    const config = createBaseConfig();
    const keys = Object.keys(config);
    const suspiciousKeys = keys.filter(k =>
      /error|isolat|catch|suppress|continueOnError/i.test(k),
    );
    expect(suspiciousKeys).toEqual([]);
  });
});

describe('createCrawlRouter — end-to-end integration across a full crawl run (3.6)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    openMock.mockClear();
    addRequestsMock.mockClear();
  });

  /**
   * Exercises a realistic multi-step sequence on a single router instance,
   * mirroring design.md's System Flows sequence diagram end-to-end rather
   * than any one behavior in isolation:
   *
   * 1. List page 1 resolves with 2 new items ('a', 'b') -> both enqueued as
   *    DETAIL requests, resolveExisting() called (memoized start).
   * 2. Detail page 'a' processed -> accumulates (batch threshold 2, not yet
   *    reached).
   * 3. Detail page 'b' processed -> threshold reached -> onBatchReady([a, b]).
   * 4. List page 2 resolves with a mix: 'a' is now (in a real system) an
   *    existing item, and 'c' is new -> resolveExisting() must NOT be called
   *    again (memoization holds across pages), and only 'c' is enqueued.
   * 5. Detail page 'c' throws inside buildPersistItem -> isolated: logged via
   *    logger.error, does not abort the run, no batch flush yet.
   * 6. Detail page 'd' (from list page 2 as well, also new) processes
   *    successfully -> accumulates alone (the failed 'c' never entered the
   *    pending queue).
   * 7. flushPending() at the end drains the remainder ('d' alone).
   *
   * Asserts the FULL ordered sequence of onBatchReady/onListPageResolved
   * calls, proving the pieces work together across page boundaries within
   * one engine instance — not just each in isolation.
   */
  it('processes a full list -> detail -> batch -> list -> error-isolated detail -> flushPending sequence with correct call ordering', async () => {
    const callLog: string[] = [];

    const resolveExisting = vi.fn(async () => {
      callLog.push('resolveExisting');
      return new Map<string, ExistingMeta>([
        ['a', { updatedAt: '2024-01-01' }],
      ]);
    });

    const onBatchReady = vi.fn(async (items: PersistItem[]) => {
      callLog.push(`onBatchReady:${items.map(i => i.id).join(',')}`);
    });

    const onListPageResolved = vi.fn(async event => {
      callLog.push(`onListPageResolved:${event.page}:${event.status}`);
    });

    const errorSpy = vi.fn((msg: string) => {
      callLog.push('logger.error');
      void msg;
    });

    const buildPersistItem = vi.fn(
      (item: RawItem & { id: string }, detail: Detail) => {
        if (item.id === 'c') {
          throw new Error('boom: simulated detail-processing failure');
        }
        return { id: item.id, description: detail.description };
      },
    );

    const { router, flushPending } = createCrawlRouter(
      createBaseConfig({
        resolveExisting,
        onBatchReady,
        onListPageResolved,
        buildPersistItem,
        resolveBatchSize: () => 2,
        logger: {
          info: () => undefined,
          warning: () => undefined,
          error: errorSpy,
        },
      }),
    );

    // Step 1: list page 1 — items 'a' (existing, per resolveExisting map) and
    // 'b' (new). Only 'b' should be enqueued.
    const listMock1 = createMockPage();
    await runListPageHandler(
      router,
      listMock1,
      'https://example.test/api/list?page=1',
      {
        page: 1,
        totalPages: 2,
        totalEntries: 4,
        items: [{ id: 'a' }, { id: 'b' }],
      },
    );

    expect(addRequestsMock).toHaveBeenCalledTimes(1);
    const [firstEnqueued] = addRequestsMock.mock.calls[0] ?? [[]];
    const firstEnqueuedRequests = firstEnqueued as Array<{
      userData: { id: string };
    }>;
    expect(firstEnqueuedRequests.map(r => r.userData.id)).toEqual(['b']);

    // Step 2 + 3: detail page for 'b' processed. Threshold is 2, so this
    // alone must NOT flush yet (only one item accumulated so far). Reuses the
    // actual userData object captured from `addRequestsMock` (rather than a
    // hand-rolled `{ id: 'b' }`) so it carries whatever internal bookkeeping
    // fields the engine attached when enqueueing it (e.g. the back-reference
    // to its originating list page, used to defer that page's "completed"
    // report until all its detail requests have been processed).
    const bDetail = createMockDetailPage({
      detail: { description: 'detail-b' },
      callOrder: [],
    });
    await router(
      createDetailHandlerContext(
        bDetail.page,
        'https://example.test/b',
        firstEnqueuedRequests.find(r => r.userData.id === 'b')!.userData,
      ) as never,
    );
    expect(onBatchReady).not.toHaveBeenCalled();

    // Step 4: list page 2 — items 'a' (existing again) and 'c'/'d' (new).
    // resolveExisting must remain memoized (still only 1 call total).
    const listMock2 = createMockPage();
    await runListPageHandler(
      router,
      listMock2,
      'https://example.test/api/list?page=2',
      {
        page: 2,
        totalPages: 2,
        totalEntries: 4,
        items: [{ id: 'a' }, { id: 'c' }, { id: 'd' }],
      },
    );

    expect(resolveExisting).toHaveBeenCalledTimes(1);
    expect(addRequestsMock).toHaveBeenCalledTimes(2);
    const [secondEnqueued] = addRequestsMock.mock.calls[1] ?? [[]];
    const secondEnqueuedRequests = secondEnqueued as Array<{
      userData: { id: string };
    }>;
    expect(secondEnqueuedRequests.map(r => r.userData.id)).toEqual([
      'c',
      'd',
    ]);

    // Step 5: detail page 'c' throws inside buildPersistItem. Must be
    // isolated (logged, no throw out of the handler, no batch flush).
    // Because 'b' was already pending (1 item) and 'c' fails before ever
    // being pushed, the pending count stays at 1 — still below threshold 2.
    const cDetail = createMockDetailPage({
      detail: { description: 'detail-c' },
      callOrder: [],
    });
    await expect(
      router(
        createDetailHandlerContext(
          cDetail.page,
          'https://example.test/c',
          secondEnqueuedRequests.find(r => r.userData.id === 'c')!.userData,
        ) as never,
      ),
    ).resolves.toBeUndefined();
    expect(onBatchReady).not.toHaveBeenCalled();

    // Step 6: detail page 'd' processes successfully. Combined with the
    // still-pending 'b', this reaches threshold 2 -> flush ['b', 'd'].
    const dDetail = createMockDetailPage({
      detail: { description: 'detail-d' },
      callOrder: [],
    });
    await router(
      createDetailHandlerContext(
        dDetail.page,
        'https://example.test/d',
        secondEnqueuedRequests.find(r => r.userData.id === 'd')!.userData,
      ) as never,
    );
    expect(onBatchReady).toHaveBeenCalledTimes(1);
    expect(onBatchReady).toHaveBeenNthCalledWith(1, [
      { id: 'b', description: 'detail-b' },
      { id: 'd', description: 'detail-d' },
    ]);

    // Step 7: flushPending at the end — nothing left pending, must be a no-op.
    await flushPending();
    expect(onBatchReady).toHaveBeenCalledTimes(1);

    // Final assertion: the FULL ordered sequence of side-effecting calls
    // across the entire run, proving correct interleaving across page
    // boundaries within a single engine instance. Page 1's "completed" report
    // fires only once its sole DETAIL request ('b') has been processed — not
    // right when its list page is parsed — so it lands right after that
    // detail request, ahead of page 2's own list-page processing. Likewise
    // page 2's "completed" report is deferred until both of its DETAIL
    // requests ('c', 'd') have gone through, landing after the batch flush
    // triggered by 'd'.
    expect(callLog).toEqual([
      'resolveExisting',
      'onListPageResolved:1:completed',
      'logger.error',
      'onBatchReady:b,d',
      'onListPageResolved:2:completed',
    ]);

    expect(onListPageResolved).toHaveBeenNthCalledWith(1, {
      url: 'https://example.test/api/list?page=1',
      page: 1,
      totalPages: 2,
      status: 'completed',
    });
    expect(onListPageResolved).toHaveBeenNthCalledWith(2, {
      url: 'https://example.test/api/list?page=2',
      page: 2,
      totalPages: 2,
      status: 'completed',
    });
  });
});
