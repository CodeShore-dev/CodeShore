import { describe, expect, it, vi } from 'vitest';

import { CacheEntryInfo, CacheService } from '@codeshore/service-cache';

import { Controller } from './controller';

function makeEntry(overrides: Partial<CacheEntryInfo> = {}): CacheEntryInfo {
  return {
    key: 'some:key',
    createdAt: '2026-08-11T00:00:00.000Z',
    ageSeconds: 0,
    ttlSeconds: null,
    expiresAt: null,
    remainingSeconds: null,
    size: 0,
    sizeHuman: '0 B',
    backend: 'memory',
    ...overrides,
  };
}

describe('Controller.list (task 3.1, design.md GET /cache byBackend breakdown)', () => {
  it('tags each returned entry with its backend unchanged (pass-through) and correctly totals each backend separately when entries are mixed (requirement 6.1, 6.4)', () => {
    const entries = [
      makeEntry({ key: 'mem:1', backend: 'memory', size: 100 }),
      makeEntry({ key: 'mem:2', backend: 'memory', size: 200 }),
      makeEntry({ key: 'redis:1', backend: 'redis', size: 1000 }),
    ];
    const cacheService = { list: vi.fn().mockReturnValue(entries) };
    const controller = new Controller(cacheService as unknown as CacheService);

    const result = controller.list();

    // pass-through: entries carry their backend field unchanged
    expect(result.entries).toBe(entries);
    expect(result.entries.map(e => e.backend)).toEqual([
      'memory',
      'memory',
      'redis',
    ]);

    // per-backend breakdown: correct subset totals, not swapped, not the grand total
    expect(result.byBackend.memory).toEqual({
      count: 2,
      totalSize: 300,
      totalSizeHuman: '300 B',
    });
    expect(result.byBackend.redis).toEqual({
      count: 1,
      totalSize: 1000,
      totalSizeHuman: '1000 B',
    });

    // existing top-level aggregation is unaffected
    expect(result.count).toBe(3);
    expect(result.totalSize).toBe(1300);
    expect(result.totalSizeHuman).toBe('1.3 KB');
  });

  it('still reports the other backend with count: 0 / totalSize: 0 when entries exist on only one backend (requirement 6.4)', () => {
    const entries = [
      makeEntry({ key: 'mem:1', backend: 'memory', size: 50 }),
      makeEntry({ key: 'mem:2', backend: 'memory', size: 150 }),
    ];
    const cacheService = { list: vi.fn().mockReturnValue(entries) };
    const controller = new Controller(cacheService as unknown as CacheService);

    const result = controller.list();

    expect(result.byBackend.memory).toEqual({
      count: 2,
      totalSize: 200,
      totalSizeHuman: '200 B',
    });
    // redis has zero entries but must still be present, not omitted
    expect(result.byBackend.redis).toEqual({
      count: 0,
      totalSize: 0,
      totalSizeHuman: '0 B',
    });
  });

  it('reports zero for both backends and the top-level totals when there are no entries at all (regression check)', () => {
    const cacheService = { list: vi.fn().mockReturnValue([]) };
    const controller = new Controller(cacheService as unknown as CacheService);

    const result = controller.list();

    expect(result.count).toBe(0);
    expect(result.totalSize).toBe(0);
    expect(result.totalSizeHuman).toBe('0 B');
    expect(result.byBackend.memory).toEqual({
      count: 0,
      totalSize: 0,
      totalSizeHuman: '0 B',
    });
    expect(result.byBackend.redis).toEqual({
      count: 0,
      totalSize: 0,
      totalSizeHuman: '0 B',
    });
  });
});
