import type { HTTPResponse, Page } from 'puppeteer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrawlRouterConfig } from './types';
import { createCrawlRouter } from './crawl-router';

// This spec drives task 3.2's slice of `createCrawlRouter`: list-page API
// response interception with configurable timeout/retry. Pagination parsing,
// item extraction, detail-page handling, batching, and progress tracking
// (tasks 3.3-3.5) are intentionally out of scope and are not asserted here.

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
