/**
 * Task 2.1: backend-selection routing in `CacheService.getOrSet`.
 *
 * Covers exactly the task's Observable line:
 * (a) an operation with `backend` omitted behaves exactly as before (routes
 *     to the memory cache only, redis cache untouched);
 * (b) selecting `backend: 'memory'` and `backend: 'redis'` independently
 *     store/retrieve their own value without cross-contamination;
 * (c) TTL expiry and hit/miss detection work identically on both backends.
 *
 * Both backends are exercised via a self-contained `FakeCache` -- a minimal
 * `cache-manager`-shaped store (`get`/`set`) with real TTL semantics driven
 * off `Date.now()` -- rather than a real Redis connection, per the task's
 * "fake/mock `Cache` instances, not a real Redis connection" instruction.
 * Time is controlled via `vi.useFakeTimers()` so expiry assertions are
 * deterministic and offline.
 *
 * Out of scope for this task (left to later tasks, not exercised here):
 * graceful degradation when `redisCache` is `undefined` or throws (2.2),
 * `backend`-tagged `meta`/`list()`/`invalidate` (2.3), and the `@Cacheable`
 * decorator's `backend` option (2.4).
 */
import { CacheService } from './cache.service';

/** Minimal `cache-manager`-shaped fake store with real TTL semantics. */
class FakeCache {
  private readonly store = new Map<string, { value: unknown; expiresAt?: number }>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttl != null ? Date.now() + ttl : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function makeService() {
  const memoryCache = new FakeCache();
  const redisCache = new FakeCache();
  const service = new CacheService(memoryCache as never, redisCache as never);
  return { service, memoryCache, redisCache };
}

describe('CacheService.getOrSet backend routing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('with no backend specified, stores/reads via the memory cache only (unchanged default behavior)', async () => {
    const { service, memoryCache, redisCache } = makeService();
    const memoryGetSpy = vi.spyOn(memoryCache, 'get');
    const memorySetSpy = vi.spyOn(memoryCache, 'set');
    const redisGetSpy = vi.spyOn(redisCache, 'get');
    const redisSetSpy = vi.spyOn(redisCache, 'set');
    const fn = vi.fn().mockResolvedValue('computed-value');

    const first = await service.getOrSet('k1', fn);
    const second = await service.getOrSet('k1', fn);

    expect(first).toBe('computed-value');
    expect(second).toBe('computed-value');
    // fn only invoked once: second call is a cache hit against memory.
    expect(fn).toHaveBeenCalledTimes(1);
    expect(memoryGetSpy).toHaveBeenCalledTimes(2);
    expect(memorySetSpy).toHaveBeenCalledTimes(1);
    expect(redisGetSpy).not.toHaveBeenCalled();
    expect(redisSetSpy).not.toHaveBeenCalled();
  });

  it('explicit backend: "memory" behaves identically to omitting backend', async () => {
    const { service, memoryCache, redisCache } = makeService();
    const fn = vi.fn().mockResolvedValue('memory-value');

    const result = await service.getOrSet('k-memory', fn, { backend: 'memory' });

    expect(result).toBe('memory-value');
    await expect(memoryCache.get('k-memory')).resolves.toBe('memory-value');
    await expect(redisCache.get('k-memory')).resolves.toBeUndefined();
  });

  it('backend: "memory" and backend: "redis" store/retrieve independently under the same key, without cross-contamination', async () => {
    const { service, memoryCache, redisCache } = makeService();

    const memoryResult = await service.getOrSet(
      'shared-key',
      () => Promise.resolve('memory-value'),
      { backend: 'memory' },
    );
    const redisResult = await service.getOrSet(
      'shared-key',
      () => Promise.resolve('redis-value'),
      { backend: 'redis' },
    );

    expect(memoryResult).toBe('memory-value');
    expect(redisResult).toBe('redis-value');
    // Re-reading each backend returns its own value, unaffected by the other.
    await expect(
      service.getOrSet('shared-key', () => Promise.resolve('should-not-be-called'), {
        backend: 'memory',
      }),
    ).resolves.toBe('memory-value');
    await expect(
      service.getOrSet('shared-key', () => Promise.resolve('should-not-be-called'), {
        backend: 'redis',
      }),
    ).resolves.toBe('redis-value');
    await expect(memoryCache.get('shared-key')).resolves.toBe('memory-value');
    await expect(redisCache.get('shared-key')).resolves.toBe('redis-value');
  });

  it.each(['memory', 'redis'] as const)(
    'backend %s: a value is a hit within its ttl and a miss (recomputed) after it expires',
    async backend => {
      const { service } = makeService();
      const fn = vi
        .fn()
        .mockResolvedValueOnce('first-value')
        .mockResolvedValueOnce('second-value');

      const first = await service.getOrSet('ttl-key', fn, { ttl: 1000, backend });
      // Still within ttl: hit, fn not called again.
      vi.advanceTimersByTime(500);
      const stillHit = await service.getOrSet('ttl-key', fn, { ttl: 1000, backend });
      // Past ttl: miss, fn called again with a fresh value.
      vi.advanceTimersByTime(600);
      const afterExpiry = await service.getOrSet('ttl-key', fn, { ttl: 1000, backend });

      expect(first).toBe('first-value');
      expect(stillHit).toBe('first-value');
      expect(afterExpiry).toBe('second-value');
      expect(fn).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['memory', 'redis'] as const)(
    'backend %s: no ttl specified means the value never expires',
    async backend => {
      const { service } = makeService();
      const fn = vi.fn().mockResolvedValue('persistent-value');

      const first = await service.getOrSet('no-ttl-key', fn, { backend });
      vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 365); // one year later
      const stillHit = await service.getOrSet('no-ttl-key', fn, { backend });

      expect(first).toBe('persistent-value');
      expect(stillHit).toBe('persistent-value');
      expect(fn).toHaveBeenCalledTimes(1);
    },
  );
});
