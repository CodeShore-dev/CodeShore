import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CrawlRouterConfig,
  CrawlRouterResult,
  ListPageResolvedEvent,
} from '@codeshore/crawler-core';
import type { SourceRegistry } from '../registry/types';
import type { SyncRepository } from './types';

// `createSyncRouter` wraps `@codeshore/crawler-core`'s `createCrawlRouter`: it
// translates `repository`/`sourceRegistry` into `resolveExisting`/
// `onBatchReady`/`onListPageResolved` and passes every other config field
// through untouched. The actual list/detail crawling behavior driven by
// `createCrawlRouter` is already exhaustively covered in
// `libs/crawler-core/src/router/crawl-router.spec.ts`, so mocking
// `createCrawlRouter` here keeps this spec focused solely on THIS task's
// wiring/translation responsibility.
const { createCrawlRouterMock } = vi.hoisted(() => {
  return { createCrawlRouterMock: vi.fn() };
});

vi.mock('@codeshore/crawler-core', async importOriginal => {
  const actual = await importOriginal<typeof import('@codeshore/crawler-core')>();
  return {
    ...actual,
    createCrawlRouter: createCrawlRouterMock,
  };
});

// Imported AFTER the vi.mock call so the mocked module is used internally by
// `create-sync-router.ts`.
import { createSyncRouter } from './create-sync-router';

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

interface Entity {
  id: string;
  description: string;
}

interface ExistingMeta {
  updatedAt: string;
}

function createMockRepository(
  overrides: Partial<SyncRepository<Entity, ExistingMeta>> = {},
): SyncRepository<Entity, ExistingMeta> {
  return {
    fetchExisting: vi.fn().mockResolvedValue(new Map<string, ExistingMeta>()),
    upsertEntities: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockSourceRegistry(
  overrides: Partial<SourceRegistry> = {},
): SourceRegistry {
  return {
    fetchPendingSources: vi.fn().mockResolvedValue([]),
    fetchBaseSources: vi.fn().mockResolvedValue([]),
    seedPendingPage1: vi.fn().mockResolvedValue(undefined),
    registerPendingPages: vi.fn().mockResolvedValue(undefined),
    markSourceStatus: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    fetchMaxKnownPageIndex: vi.fn().mockResolvedValue(new Map()),
    ...overrides,
  };
}

const FAKE_CRAWL_ROUTER_RESULT: CrawlRouterResult = {
  router: {} as CrawlRouterResult['router'],
  flushPending: vi.fn().mockResolvedValue(undefined),
};

describe('createSyncRouter', () => {
  beforeEach(() => {
    createCrawlRouterMock.mockReset();
    createCrawlRouterMock.mockReturnValue(FAKE_CRAWL_ROUTER_RESULT);
  });

  it('passes repository.fetchExisting through as resolveExisting on the underlying createCrawlRouter config', () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    createSyncRouter<ListResponse, RawItem, Detail, Entity, ExistingMeta>({
      matchListResponse: url => url.includes('/api/list'),
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'x' }),
      buildPersistItem: item => ({ id: item.id, description: 'x' }),
      repository,
      sourceRegistry,
    });

    expect(createCrawlRouterMock).toHaveBeenCalledTimes(1);
    const passedConfig = createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >;
    expect(passedConfig.resolveExisting).toBeInstanceOf(Function);

    passedConfig.resolveExisting();
    expect(repository.fetchExisting).toHaveBeenCalledTimes(1);
  });

  it('passes repository.upsertEntities through as onBatchReady on the underlying createCrawlRouter config', async () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    createSyncRouter<ListResponse, RawItem, Detail, Entity, ExistingMeta>({
      matchListResponse: url => url.includes('/api/list'),
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'x' }),
      buildPersistItem: item => ({ id: item.id, description: 'x' }),
      repository,
      sourceRegistry,
    });

    const passedConfig = createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >;

    const entities: Entity[] = [{ id: '1', description: 'x' }];
    await passedConfig.onBatchReady(entities);
    expect(repository.upsertEntities).toHaveBeenCalledTimes(1);
    expect(repository.upsertEntities).toHaveBeenCalledWith(entities);
  });

  it('calls both registerPendingPages and markSourceStatus when a first page of a multi-page source completes', async () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    createSyncRouter<ListResponse, RawItem, Detail, Entity, ExistingMeta>({
      matchListResponse: url => url.includes('/api/list'),
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'x' }),
      buildPersistItem: item => ({ id: item.id, description: 'x' }),
      repository,
      sourceRegistry,
    });

    const passedConfig = createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >;

    const event: ListPageResolvedEvent = {
      url: 'https://example.test/source-a',
      page: 1,
      totalPages: 3,
      status: 'completed',
    };
    await passedConfig.onListPageResolved(event);

    expect(sourceRegistry.registerPendingPages).toHaveBeenCalledTimes(1);
    expect(sourceRegistry.registerPendingPages).toHaveBeenCalledWith(
      'https://example.test/source-a',
      3,
    );
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledTimes(1);
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledWith(
      'https://example.test/source-a',
      1,
      'completed',
    );
  });

  it('only calls markSourceStatus (not registerPendingPages) when a completed page is not the first page', async () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    createSyncRouter<ListResponse, RawItem, Detail, Entity, ExistingMeta>({
      matchListResponse: url => url.includes('/api/list'),
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'x' }),
      buildPersistItem: item => ({ id: item.id, description: 'x' }),
      repository,
      sourceRegistry,
    });

    const passedConfig = createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >;

    const event: ListPageResolvedEvent = {
      url: 'https://example.test/source-a',
      page: 2,
      totalPages: 3,
      status: 'completed',
    };
    await passedConfig.onListPageResolved(event);

    expect(sourceRegistry.registerPendingPages).not.toHaveBeenCalled();
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledTimes(1);
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledWith(
      'https://example.test/source-a',
      2,
      'completed',
    );
  });

  it('only calls markSourceStatus (not registerPendingPages) when a single-page source completes (page 1, totalPages 1)', async () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    createSyncRouter<ListResponse, RawItem, Detail, Entity, ExistingMeta>({
      matchListResponse: url => url.includes('/api/list'),
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'x' }),
      buildPersistItem: item => ({ id: item.id, description: 'x' }),
      repository,
      sourceRegistry,
    });

    const passedConfig = createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >;

    const event: ListPageResolvedEvent = {
      url: 'https://example.test/source-single',
      page: 1,
      totalPages: 1,
      status: 'completed',
    };
    await passedConfig.onListPageResolved(event);

    expect(sourceRegistry.registerPendingPages).not.toHaveBeenCalled();
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledTimes(1);
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledWith(
      'https://example.test/source-single',
      1,
      'completed',
    );
  });

  it('only calls markSourceStatus with "failed" (never registerPendingPages) when a page fails, regardless of page number', async () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    createSyncRouter<ListResponse, RawItem, Detail, Entity, ExistingMeta>({
      matchListResponse: url => url.includes('/api/list'),
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'x' }),
      buildPersistItem: item => ({ id: item.id, description: 'x' }),
      repository,
      sourceRegistry,
    });

    const passedConfig = createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >;

    const event: ListPageResolvedEvent = {
      url: 'https://example.test/source-a',
      page: 1,
      totalPages: 3,
      status: 'failed',
    };
    await passedConfig.onListPageResolved(event);

    expect(sourceRegistry.registerPendingPages).not.toHaveBeenCalled();
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledTimes(1);
    expect(sourceRegistry.markSourceStatus).toHaveBeenCalledWith(
      'https://example.test/source-a',
      1,
      'failed',
    );
  });

  it('passes every other config field through to createCrawlRouter unchanged', () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    const matchListResponse = (url: string) => url.includes('/api/list');
    const parsePagination = (response: ListResponse) => ({
      currentPage: response.page,
      totalPages: response.totalPages,
      totalEntries: response.totalEntries,
    });
    const extractItems = (response: ListResponse) => response.items;
    const extractDetailOnHTML = () => ({ description: 'x' });
    const buildPersistItem = (item: RawItem) => ({
      id: item.id,
      description: 'x',
    });
    const resolveBatchSize = () => 5;
    const detailPageWaitSelector = '.detail-root';

    createSyncRouter<ListResponse, RawItem, Detail, Entity, ExistingMeta>({
      matchListResponse,
      listResponseTimeoutMs: 12345,
      maxListRetries: 7,
      parsePagination,
      extractItems,
      detailPageWaitSelector,
      extractDetailOnHTML,
      buildPersistItem,
      resolveBatchSize,
      repository,
      sourceRegistry,
    });

    const passedConfig = createCrawlRouterMock.mock.calls[0][0] as CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >;

    expect(passedConfig.matchListResponse).toBe(matchListResponse);
    expect(passedConfig.parsePagination).toBe(parsePagination);
    expect(passedConfig.extractItems).toBe(extractItems);
    expect(passedConfig.detailPageWaitSelector).toBe(detailPageWaitSelector);
    expect(passedConfig.extractDetailOnHTML).toBe(extractDetailOnHTML);
    expect(passedConfig.buildPersistItem).toBe(buildPersistItem);
    expect(passedConfig.resolveBatchSize).toBe(resolveBatchSize);
    expect(passedConfig.listResponseTimeoutMs).toBe(12345);
    expect(passedConfig.maxListRetries).toBe(7);
  });

  it('returns the CrawlRouterResult produced by the underlying createCrawlRouter unchanged', () => {
    const repository = createMockRepository();
    const sourceRegistry = createMockSourceRegistry();

    const result = createSyncRouter<
      ListResponse,
      RawItem,
      Detail,
      Entity,
      ExistingMeta
    >({
      matchListResponse: url => url.includes('/api/list'),
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'x' }),
      buildPersistItem: item => ({ id: item.id, description: 'x' }),
      repository,
      sourceRegistry,
    });

    expect(result).toBe(FAKE_CRAWL_ROUTER_RESULT);
  });
});
