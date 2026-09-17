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

/** Minimal `ServiceLogger`-shaped fake, only `warn` is exercised here. */
function makeLogger() {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeService() {
  const memoryCache = new FakeCache();
  const redisCache = new FakeCache();
  const logger = makeLogger();
  const service = new CacheService(
    memoryCache as never,
    redisCache as never,
    logger as never,
  );
  return { service, memoryCache, redisCache, logger };
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

/**
 * Task 2.2: graceful degradation when the Redis backend is unavailable
 * (missing configuration) or a runtime operation on it fails.
 *
 * Per design.md's getOrSet flow:
 * - `resolveCache('redis')` returning `undefined` -> run `fn()` directly,
 *   return its result, no meta write, not an error.
 * - `cache.get` throwing with `backend === 'redis'` -> log a warning, run
 *   `fn()` directly, return its result.
 * - `cache.set` throwing with `backend === 'redis'` -> log a warning,
 *   swallow the error, still return the already-computed result.
 * - None of the above applies to `backend === 'memory'`: exceptions there
 *   must propagate exactly as they did before this task.
 * - The caller's own `fn()` throwing is a completely different failure mode
 *   and must never be swallowed/reinterpreted as a cache degradation, for
 *   either backend.
 */
describe('CacheService.getOrSet graceful degradation (redis unavailable)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('backend "redis" with no Redis cache configured (redisCache undefined) still returns fn()\'s result without throwing', async () => {
    const memoryCache = new FakeCache();
    const logger = makeLogger();
    const service = new CacheService(memoryCache as never, undefined, logger as never);
    const fn = vi.fn().mockResolvedValue('computed-value');

    const result = await service.getOrSet('k1', fn, { backend: 'redis' });

    expect(result).toBe('computed-value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('backend "redis" whose cache.get rejects still returns fn()\'s result without throwing, and logs a warning', async () => {
    const memoryCache = new FakeCache();
    const logger = makeLogger();
    const redisCache = {
      get: vi.fn().mockRejectedValue(new Error('redis connection lost')),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const service = new CacheService(
      memoryCache as never,
      redisCache as never,
      logger as never,
    );
    const fn = vi.fn().mockResolvedValue('computed-value');

    const result = await service.getOrSet('k1', fn, { backend: 'redis' });

    expect(result).toBe('computed-value');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('backend "redis" whose cache.set rejects (get resolves as a miss) still returns the freshly-computed result without throwing, and logs a warning', async () => {
    const memoryCache = new FakeCache();
    const logger = makeLogger();
    const redisCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockRejectedValue(new Error('redis write failed')),
    };
    const service = new CacheService(
      memoryCache as never,
      redisCache as never,
      logger as never,
    );
    const fn = vi.fn().mockResolvedValue('fresh-value');

    const result = await service.getOrSet('k1', fn, { backend: 'redis' });

    expect(result).toBe('fresh-value');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(redisCache.set).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('the caller\'s own fn() throwing propagates unchanged, even for backend "redis" with a fully working Redis cache (not treated as a cache degradation)', async () => {
    const { service } = makeService();
    const callerError = new Error('caller business logic failed');
    const fn = vi.fn().mockRejectedValue(callerError);

    await expect(
      service.getOrSet('k1', fn, { backend: 'redis' }),
    ).rejects.toThrow(callerError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a failing redis backend does not affect a parallel memory-backed operation in the same run', async () => {
    const memoryCache = new FakeCache();
    const logger = makeLogger();
    const redisCache = {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
      set: vi.fn().mockRejectedValue(new Error('redis down')),
    };
    const service = new CacheService(
      memoryCache as never,
      redisCache as never,
      logger as never,
    );
    const redisFn = vi.fn().mockResolvedValue('redis-value');
    const memoryFn = vi.fn().mockResolvedValue('memory-value');

    const [redisResult, memoryResult] = await Promise.all([
      service.getOrSet('shared-key', redisFn, { backend: 'redis' }),
      service.getOrSet('shared-key', memoryFn, { backend: 'memory' }),
    ]);

    expect(redisResult).toBe('redis-value');
    expect(memoryResult).toBe('memory-value');
    // The memory-backed write actually landed in the memory store, proving
    // the redis degradation path never touched it.
    await expect(memoryCache.get('shared-key')).resolves.toBe('memory-value');
  });

  it('backend "memory" gains zero new error-handling behavior: a cache.get failure still propagates unchanged (regression, pre-existing behavior)', async () => {
    const memoryCache = {
      get: vi.fn().mockRejectedValue(new Error('unexpected memory store failure')),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const redisCache = new FakeCache();
    const logger = makeLogger();
    const service = new CacheService(
      memoryCache as never,
      redisCache as never,
      logger as never,
    );
    const fn = vi.fn().mockResolvedValue('should-not-be-reached');

    await expect(
      service.getOrSet('k1', fn, { backend: 'memory' }),
    ).rejects.toThrow('unexpected memory store failure');
    // fn must not have been called: the exception is not degraded into a
    // "run the original logic" path for the memory backend.
    expect(fn).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('backend "memory" gains zero new error-handling behavior: a cache.set failure still propagates unchanged (regression, pre-existing behavior)', async () => {
    const memoryCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockRejectedValue(new Error('unexpected memory store write failure')),
    };
    const redisCache = new FakeCache();
    const logger = makeLogger();
    const service = new CacheService(
      memoryCache as never,
      redisCache as never,
      logger as never,
    );
    const fn = vi.fn().mockResolvedValue('computed-value');

    await expect(
      service.getOrSet('k1', fn, { backend: 'memory' }),
    ).rejects.toThrow('unexpected memory store write failure');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

/**
 * Task 2.3: per-entry backend bookkeeping, and invalidation that routes to
 * whichever backend actually holds the entry.
 *
 * Per design.md's `CacheService(擴充)` section:
 * - `getOrSet`'s meta write records the resolved `backend` (Req 6.1).
 * - `list()` surfaces that `backend` on every returned `CacheEntryInfo`
 *   (Req 6.1).
 * - `invalidate(keys)` looks up each key's backend from `meta` (default
 *   'memory') and calls `.del()` on the matching `Cache` instance; a
 *   `backend === 'redis'` failure is logged and skipped (doesn't abort the
 *   rest of the batch), a `backend === 'memory'` failure propagates exactly
 *   as it always has (no try/catch ever existed for the memory path) (Req
 *   6.2).
 * - `invalidateAll()` delegates to `invalidate([...meta.keys()])` rather
 *   than duplicating the loop, and so covers both backends for free (Req
 *   6.3).
 */
describe('CacheService backend-aware list/invalidate/invalidateAll (Task 2.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('list() reports the correct backend for an entry stored on each backend', async () => {
    const { service } = makeService();

    await service.getOrSet('mem-key', () => Promise.resolve('memory-value'), {
      backend: 'memory',
    });
    await service.getOrSet('redis-key', () => Promise.resolve('redis-value'), {
      backend: 'redis',
    });

    const entries = service.list();
    const byKey = new Map(entries.map(e => [e.key, e]));

    expect(byKey.get('mem-key')?.backend).toBe('memory');
    expect(byKey.get('redis-key')?.backend).toBe('redis');
  });

  it('invalidate(key) for a key stored via the redis backend calls .del() on the redis mock, not the memory mock, and removes it from list()', async () => {
    const { service, memoryCache, redisCache } = makeService();
    await service.getOrSet('redis-key', () => Promise.resolve('redis-value'), {
      backend: 'redis',
    });
    const memoryDelSpy = vi.spyOn(memoryCache, 'del');
    const redisDelSpy = vi.spyOn(redisCache, 'del');

    await service.invalidate('redis-key');

    expect(redisDelSpy).toHaveBeenCalledWith('redis-key');
    expect(memoryDelSpy).not.toHaveBeenCalled();
    expect(service.list().find(e => e.key === 'redis-key')).toBeUndefined();
  });

  it('invalidate(key) for a key stored via the memory backend calls .del() on the memory mock, not the redis mock', async () => {
    const { service, memoryCache, redisCache } = makeService();
    await service.getOrSet('mem-key', () => Promise.resolve('memory-value'), {
      backend: 'memory',
    });
    const memoryDelSpy = vi.spyOn(memoryCache, 'del');
    const redisDelSpy = vi.spyOn(redisCache, 'del');

    await service.invalidate('mem-key');

    expect(memoryDelSpy).toHaveBeenCalledWith('mem-key');
    expect(redisDelSpy).not.toHaveBeenCalled();
    expect(service.list().find(e => e.key === 'mem-key')).toBeUndefined();
  });

  it('invalidateAll() removes entries from both backends', async () => {
    const { service, memoryCache, redisCache } = makeService();
    await service.getOrSet('mem-key', () => Promise.resolve('memory-value'), {
      backend: 'memory',
    });
    await service.getOrSet('redis-key', () => Promise.resolve('redis-value'), {
      backend: 'redis',
    });
    const memoryDelSpy = vi.spyOn(memoryCache, 'del');
    const redisDelSpy = vi.spyOn(redisCache, 'del');

    const removed = await service.invalidateAll();

    expect(removed.sort()).toEqual(['mem-key', 'redis-key'].sort());
    expect(memoryDelSpy).toHaveBeenCalledWith('mem-key');
    expect(redisDelSpy).toHaveBeenCalledWith('redis-key');
    expect(service.list()).toEqual([]);
  });

  it('invalidate() on a key whose backend is redis but redis is currently unavailable (.del() throws) does not throw and still removes the key from list()', async () => {
    const memoryCache = new FakeCache();
    const redisCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockRejectedValue(new Error('redis connection lost')),
    };
    const logger = makeLogger();
    const service = new CacheService(
      memoryCache as never,
      redisCache as never,
      logger as never,
    );
    await service.getOrSet('redis-key', () => Promise.resolve('redis-value'), {
      backend: 'redis',
    });

    await expect(service.invalidate('redis-key')).resolves.toEqual(['redis-key']);

    expect(logger.warn).toHaveBeenCalled();
    expect(service.list().find(e => e.key === 'redis-key')).toBeUndefined();
  });

  it('invalidate()/invalidateAll() for memory-only entries is unchanged: a memory .del() failure still propagates (no swallowed errors)', async () => {
    const memoryCache = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockRejectedValue(new Error('unexpected memory delete failure')),
    };
    const redisCache = new FakeCache();
    const logger = makeLogger();
    const service = new CacheService(
      memoryCache as never,
      redisCache as never,
      logger as never,
    );
    await service.getOrSet('mem-key', () => Promise.resolve('memory-value'), {
      backend: 'memory',
    });

    await expect(service.invalidate('mem-key')).rejects.toThrow(
      'unexpected memory delete failure',
    );
    await expect(service.invalidateAll()).rejects.toThrow(
      'unexpected memory delete failure',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

/**
 * Task 4.1: whole-lifecycle integration-style validation that mixed-backend
 * cache management operations (create, list, selectively invalidate, clear
 * all) behave correctly together and never let an operation on one backend
 * disturb entries on the other (Req 1.3, 6.1-6.4).
 *
 * Unlike the per-method unit tests above (which each isolate a single
 * `getOrSet`/`invalidate`/`invalidateAll` call), this walks the full
 * realistic scenario through one `CacheService` instance backed by two
 * independent, real `FakeCache` instances (Map-backed, not call-recording
 * stubs) so that a bug like "invalidating one key accidentally deletes a
 * different key from the same underlying store" would actually surface.
 */
describe('CacheService mixed-backend integration (Task 4.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('walks create -> list -> selective invalidate (per backend) -> invalidateAll, confirming full per-backend isolation at every step', async () => {
    const { service, memoryCache, redisCache } = makeService();

    // --- create: two entries per backend ---
    await service.getOrSet('memory-key-1', () => Promise.resolve('memory-value-1'), {
      backend: 'memory',
    });
    await service.getOrSet('redis-key-1', () => Promise.resolve('redis-value-1'), {
      backend: 'redis',
    });
    await service.getOrSet('memory-key-2', () => Promise.resolve('memory-value-2'), {
      backend: 'memory',
    });
    await service.getOrSet('redis-key-2', () => Promise.resolve('redis-value-2'), {
      backend: 'redis',
    });

    // --- list: all 4 entries present, correctly tagged ---
    const afterCreate = new Map(service.list().map(e => [e.key, e]));
    expect(afterCreate.size).toBe(4);
    expect(afterCreate.get('memory-key-1')?.backend).toBe('memory');
    expect(afterCreate.get('memory-key-2')?.backend).toBe('memory');
    expect(afterCreate.get('redis-key-1')?.backend).toBe('redis');
    expect(afterCreate.get('redis-key-2')?.backend).toBe('redis');

    // --- invalidate a single redis key: only that key/backend affected ---
    await service.invalidate('redis-key-1');

    const afterRedisInvalidate = new Map(service.list().map(e => [e.key, e]));
    expect(afterRedisInvalidate.has('redis-key-1')).toBe(false);
    expect(afterRedisInvalidate.has('redis-key-2')).toBe(true);
    expect(afterRedisInvalidate.has('memory-key-1')).toBe(true);
    expect(afterRedisInvalidate.has('memory-key-2')).toBe(true);
    // Real underlying store checked directly, not just meta-driven list().
    await expect(redisCache.get('redis-key-1')).resolves.toBeUndefined();
    await expect(redisCache.get('redis-key-2')).resolves.toBe('redis-value-2');
    // The memory store is completely untouched by a redis-only invalidate.
    await expect(memoryCache.get('memory-key-1')).resolves.toBe('memory-value-1');
    await expect(memoryCache.get('memory-key-2')).resolves.toBe('memory-value-2');

    // --- invalidate a single memory key: symmetric check ---
    await service.invalidate('memory-key-1');

    const afterMemoryInvalidate = new Map(service.list().map(e => [e.key, e]));
    expect(afterMemoryInvalidate.has('memory-key-1')).toBe(false);
    expect(afterMemoryInvalidate.has('memory-key-2')).toBe(true);
    expect(afterMemoryInvalidate.has('redis-key-2')).toBe(true);
    await expect(memoryCache.get('memory-key-1')).resolves.toBeUndefined();
    await expect(memoryCache.get('memory-key-2')).resolves.toBe('memory-value-2');
    // The redis store is completely untouched by a memory-only invalidate.
    await expect(redisCache.get('redis-key-2')).resolves.toBe('redis-value-2');

    // --- invalidateAll: both backends fully cleared, in list() and in the
    // real underlying stores (not just meta looking empty). ---
    const removed = await service.invalidateAll();

    expect(removed.sort()).toEqual(['memory-key-2', 'redis-key-2'].sort());
    expect(service.list()).toEqual([]);
    await expect(memoryCache.get('memory-key-2')).resolves.toBeUndefined();
    await expect(redisCache.get('redis-key-2')).resolves.toBeUndefined();

    // --- a getOrSet on a previously-invalidated key is a genuine fresh MISS,
    // not a stale value or cross-backend leftover. ---
    const freshRedisFn = vi.fn().mockResolvedValue('fresh-redis-value');
    const freshRedisResult = await service.getOrSet('redis-key-1', freshRedisFn, {
      backend: 'redis',
    });
    expect(freshRedisResult).toBe('fresh-redis-value');
    expect(freshRedisFn).toHaveBeenCalledTimes(1);

    const freshMemoryFn = vi.fn().mockResolvedValue('fresh-memory-value');
    const freshMemoryResult = await service.getOrSet('memory-key-1', freshMemoryFn, {
      backend: 'memory',
    });
    expect(freshMemoryResult).toBe('fresh-memory-value');
    expect(freshMemoryFn).toHaveBeenCalledTimes(1);
  });
});
