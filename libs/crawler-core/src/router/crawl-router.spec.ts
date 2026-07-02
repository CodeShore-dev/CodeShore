import type { HTTPResponse, Page } from 'puppeteer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrawlRouterConfig } from './types';
import { createCrawlRouter } from './crawl-router';

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
}): HTTPResponse {
  const { url, method = 'GET', status = 200, json = {} } = options;
  return {
    request: () => ({ method: () => method }),
    url: () => url,
    status: () => status,
    json: async () => json,
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
function createHandlerContext(page: Page, requestUrl: string) {
  return {
    request: { url: requestUrl, loadedUrl: requestUrl, userData: {} },
    page,
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    enqueueLinks: vi.fn(async () => undefined),
  };
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
