import { describe, expect, it } from 'vitest';

import type {
  CrawlItemBase,
  CrawlRouterConfig,
  ListPageResolvedEvent,
  ListPageStatus,
  RequireDetailCrawl,
} from './types';

// This spec's real job is to force `tsc` (via `nx build crawler-core`) to
// type-check genuine usages of every interface exported from `./types`.
// Runtime assertions here only confirm the object literals exist as expected;
// the actual correctness proof is that this file compiles with zero `any`
// and zero type errors.

describe('router/types', () => {
  it('CrawlItemBase accepts a minimal object literal with just an id', () => {
    const item: CrawlItemBase = { id: 'item-1' };

    expect(item.id).toBe('item-1');
  });

  it('RequireDetailCrawl<TExistingMeta> accepts a fully-typed generic object literal', () => {
    interface ExistingMeta {
      updatedAt: string;
    }

    const withExisting: RequireDetailCrawl<ExistingMeta> = {
      id: 'item-2',
      title: 'Example title',
      url: 'https://example.test/item-2',
      existingItem: { updatedAt: '2026-07-01T00:00:00.000Z' },
      needToCreate: false,
    };

    const withoutExisting: RequireDetailCrawl<ExistingMeta> = {
      id: 'item-3',
      title: 'Another title',
      url: 'https://example.test/item-3',
      existingItem: undefined,
      needToCreate: true,
    };

    expect(withExisting.existingItem?.updatedAt).toBe(
      '2026-07-01T00:00:00.000Z',
    );
    expect(withoutExisting.existingItem).toBeUndefined();
  });

  it('ListPageStatus only permits the two documented literal values', () => {
    const completed: ListPageStatus = 'completed';
    const failed: ListPageStatus = 'failed';

    expect([completed, failed]).toEqual(['completed', 'failed']);
  });

  it('ListPageResolvedEvent accepts a fully-typed object literal', () => {
    const event: ListPageResolvedEvent = {
      url: 'https://example.test/list?page=2',
      page: 2,
      totalPages: 10,
      status: 'completed',
    };

    expect(event.status).toBe('completed');
  });

  it('CrawlRouterConfig accepts a fully-typed object literal with every required callback', () => {
    interface RawItem extends CrawlItemBase {
      title: string;
      url: string;
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
    interface ListResponse {
      page: number;
      totalPages: number;
      totalEntries: number;
      items: RawItem[];
    }

    const config: CrawlRouterConfig<
      ListResponse,
      RawItem,
      Detail,
      PersistItem,
      ExistingMeta
    > = {
      matchListResponse: (url: string) => url.includes('/api/list'),
      listResponseTimeoutMs: 30000,
      maxListRetries: 10,
      waitForListPage: async () => {
        /* no-op for type-usage smoke test */
      },
      parsePagination: response => ({
        currentPage: response.page,
        totalPages: response.totalPages,
        totalEntries: response.totalEntries,
      }),
      extractItems: response => response.items,
      transformItem: item => item,
      resolveExisting: async () => new Map<string, ExistingMeta>(),
      detailPageWaitSelector: '.detail-root',
      extractDetailOnHTML: () => ({ description: 'stub' }),
      buildPersistItem: (item, detail) => ({
        id: item.id,
        description: detail.description,
      }),
      resolveBatchSize: () => 1,
      onBatchReady: async () => {
        /* no-op for type-usage smoke test */
      },
      onListPageResolved: async () => {
        /* no-op for type-usage smoke test */
      },
      logger: {
        info: () => undefined,
        warning: () => undefined,
        error: () => undefined,
      },
    };

    expect(config.matchListResponse('https://example.test/api/list')).toBe(
      true,
    );
    expect(
      config.parsePagination({
        page: 1,
        totalPages: 5,
        totalEntries: 50,
        items: [],
      }),
    ).toEqual({ currentPage: 1, totalPages: 5, totalEntries: 50 });
  });
});
