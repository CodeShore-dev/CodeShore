import { describe, expect, it, vi } from 'vitest';

import { resolveSourcesToProcess } from './resolve-sources';
import type { SourceRegistry } from './types';

function createMockRegistry(
  overrides: Partial<SourceRegistry> = {},
): SourceRegistry {
  return {
    fetchPendingSources: vi.fn().mockResolvedValue([]),
    fetchBaseSources: vi.fn().mockResolvedValue([]),
    registerPendingPages: vi.fn().mockResolvedValue(undefined),
    markSourceStatus: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('resolveSourcesToProcess', () => {
  it('resume mode with pending sources returns exactly those pending sources, without touching fetchBaseSources or clearAll', async () => {
    const pending = [
      { url: 'https://example.com/a', pageIndex: 2 },
      { url: 'https://example.com/b', pageIndex: 1 },
    ];
    const registry = createMockRegistry({
      fetchPendingSources: vi.fn().mockResolvedValue(pending),
    });

    const result = await resolveSourcesToProcess(
      registry,
      'resume',
    );

    expect(result).toEqual(pending);
    expect(registry.fetchPendingSources).toHaveBeenCalledTimes(
      1,
    );
    expect(registry.fetchBaseSources).not.toHaveBeenCalled();
    expect(registry.clearAll).not.toHaveBeenCalled();
  });

  it('resume mode with no pending sources returns an empty array, without touching fetchBaseSources or clearAll', async () => {
    const registry = createMockRegistry({
      fetchPendingSources: vi.fn().mockResolvedValue([]),
    });

    const result = await resolveSourcesToProcess(
      registry,
      'resume',
    );

    expect(result).toEqual([]);
    expect(registry.fetchBaseSources).not.toHaveBeenCalled();
    expect(registry.clearAll).not.toHaveBeenCalled();
  });

  it('fresh mode clears all tracked state first, then maps every base source to page 1, regardless of any pre-existing pending sources', async () => {
    const callOrder: string[] = [];
    const registry = createMockRegistry({
      fetchPendingSources: vi.fn().mockImplementation(() => {
        callOrder.push('fetchPendingSources');
        return Promise.resolve([
          { url: 'https://example.com/stale', pageIndex: 3 },
        ]);
      }),
      clearAll: vi.fn().mockImplementation(() => {
        callOrder.push('clearAll');
        return Promise.resolve(undefined);
      }),
      fetchBaseSources: vi.fn().mockImplementation(() => {
        callOrder.push('fetchBaseSources');
        return Promise.resolve([
          'https://example.com/a',
          'https://example.com/b',
        ]);
      }),
    });

    const result = await resolveSourcesToProcess(
      registry,
      'fresh',
    );

    expect(result).toEqual([
      { url: 'https://example.com/a', pageIndex: 1 },
      { url: 'https://example.com/b', pageIndex: 1 },
    ]);
    expect(registry.clearAll).toHaveBeenCalledTimes(1);
    expect(registry.fetchBaseSources).toHaveBeenCalledTimes(1);
    expect(callOrder.indexOf('clearAll')).toBeLessThan(
      callOrder.indexOf('fetchBaseSources'),
    );
    // fetchPendingSources must not even be consulted in fresh mode: clearAll
    // already wipes any pre-existing pending state, so the result is driven
    // solely by fetchBaseSources.
    expect(registry.fetchPendingSources).not.toHaveBeenCalled();
  });

  it('fresh mode with zero base sources returns an empty array after clearing', async () => {
    const registry = createMockRegistry({
      fetchBaseSources: vi.fn().mockResolvedValue([]),
    });

    const result = await resolveSourcesToProcess(
      registry,
      'fresh',
    );

    expect(result).toEqual([]);
    expect(registry.clearAll).toHaveBeenCalledTimes(1);
    expect(registry.fetchBaseSources).toHaveBeenCalledTimes(1);
  });
});
