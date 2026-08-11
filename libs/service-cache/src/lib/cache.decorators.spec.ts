/**
 * Task 2.4: the `@Cacheable` method-caching shortcut threads its optional
 * `backend` option through to `CacheService.getOrSet`.
 *
 * Per design.md's "@Cacheable / @CacheEvict(擴充)" section (Summary-only,
 * pure parameter threading, no new logic branches):
 * - `Cacheable`'s call to `cs.getOrSet` passes `{ ttl: ..., backend: opts.backend }`.
 * - `opts.backend` is passed through as-is; when omitted, `getOrSet` itself
 *   already defaults to `'memory'`.
 * - `CacheEvict` needs no changes -- `invalidate(keys)` already resolves
 *   each key's actual backend from `CacheService`'s internal `meta` map.
 *
 * Both backends are exercised via a self-contained `FakeCache` -- the same
 * minimal `cache-manager`-shaped store (`get`/`set`) used in
 * `cache.service.spec.ts` -- rather than a real Redis connection.
 */
import {
  Cacheable,
  CacheableOptions,
  CacheEvict,
  CacheEvictOptions,
} from './cache.decorators';
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

/** Minimal `ServiceLogger`-shaped fake. */
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

/** A minimal host class carrying an injected `cacheService`, decorated per test. */
class Host {
  cacheService?: CacheService;

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
  }
}

/**
 * Applies `Cacheable`/`CacheEvict` to a prototype method imperatively (the
 * runtime equivalent of `@Cacheable(opts)` above a method declaration),
 * without relying on non-null assertions to bridge `PropertyDescriptor`'s
 * optional return from `Object.getOwnPropertyDescriptor`.
 */
function getOwnDescriptorOrThrow(proto: object, method: string): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(proto, method);
  if (!descriptor) {
    throw new Error(`Expected an own property descriptor for '${method}'`);
  }
  return descriptor;
}

function applyCacheable(proto: object, method: string, opts: CacheableOptions): void {
  const descriptor = getOwnDescriptorOrThrow(proto, method);
  Object.defineProperty(proto, method, Cacheable(opts)(proto, method, descriptor));
}

function applyCacheEvict(proto: object, method: string, opts: CacheEvictOptions): void {
  const descriptor = getOwnDescriptorOrThrow(proto, method);
  Object.defineProperty(proto, method, CacheEvict(opts)(proto, method, descriptor));
}

describe('@Cacheable backend routing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a method decorated with no backend option still routes through the memory backend (regression)', async () => {
    const { service, memoryCache, redisCache } = makeService();
    const memoryGetSpy = vi.spyOn(memoryCache, 'get');
    const memorySetSpy = vi.spyOn(memoryCache, 'set');
    const redisGetSpy = vi.spyOn(redisCache, 'get');
    const redisSetSpy = vi.spyOn(redisCache, 'set');
    const compute = vi.fn().mockResolvedValue('computed-value');

    class Target extends Host {
      async load() {
        return compute();
      }
    }
    applyCacheable(Target.prototype, 'load', { key: 'no-backend-key' });

    const target = new Target(service);
    const first = await target.load();
    const second = await target.load();

    expect(first).toBe('computed-value');
    expect(second).toBe('computed-value');
    expect(compute).toHaveBeenCalledTimes(1);
    expect(memoryGetSpy).toHaveBeenCalledTimes(2);
    expect(memorySetSpy).toHaveBeenCalledTimes(1);
    expect(redisGetSpy).not.toHaveBeenCalled();
    expect(redisSetSpy).not.toHaveBeenCalled();
  });

  it('a method decorated with backend: "redis" routes through the redis backend, not memory', async () => {
    const { service, memoryCache, redisCache } = makeService();
    const memoryGetSpy = vi.spyOn(memoryCache, 'get');
    const memorySetSpy = vi.spyOn(memoryCache, 'set');
    const redisGetSpy = vi.spyOn(redisCache, 'get');
    const redisSetSpy = vi.spyOn(redisCache, 'set');
    const compute = vi.fn().mockResolvedValue('redis-computed-value');

    class Target extends Host {
      async load() {
        return compute();
      }
    }
    applyCacheable(Target.prototype, 'load', { key: 'redis-key', backend: 'redis' });

    const target = new Target(service);
    const first = await target.load();
    const second = await target.load();

    expect(first).toBe('redis-computed-value');
    expect(second).toBe('redis-computed-value');
    expect(compute).toHaveBeenCalledTimes(1);
    expect(redisGetSpy).toHaveBeenCalledTimes(2);
    expect(redisSetSpy).toHaveBeenCalledTimes(1);
    expect(memoryGetSpy).not.toHaveBeenCalled();
    expect(memorySetSpy).not.toHaveBeenCalled();
  });

  it('threads both ttl (seconds -> ms) and backend together: a redis-backed entry expires per its ttl', async () => {
    const { service } = makeService();
    const compute = vi
      .fn()
      .mockResolvedValueOnce('first-value')
      .mockResolvedValueOnce('second-value');

    class Target extends Host {
      async load() {
        return compute();
      }
    }
    applyCacheable(Target.prototype, 'load', {
      key: 'ttl-redis-key',
      ttl: 1,
      backend: 'redis',
    });

    const target = new Target(service);
    const first = await target.load();
    vi.advanceTimersByTime(500);
    const stillHit = await target.load();
    vi.advanceTimersByTime(600);
    const afterExpiry = await target.load();

    expect(first).toBe('first-value');
    expect(stillHit).toBe('first-value');
    expect(afterExpiry).toBe('second-value');
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe('@CacheEvict (unchanged, no backend option)', () => {
  it('invalidates a redis-backed entry written via @Cacheable without needing its own backend option', async () => {
    const { service, memoryCache, redisCache } = makeService();
    const compute = vi.fn().mockResolvedValue('value-to-evict');
    const mutate = vi.fn().mockResolvedValue('mutation-result');

    class Target extends Host {
      async load() {
        return compute();
      }
      async clear() {
        return mutate();
      }
    }
    applyCacheable(Target.prototype, 'load', { key: 'evict-key', backend: 'redis' });
    applyCacheEvict(Target.prototype, 'clear', { keys: 'evict-key' });

    const target = new Target(service);
    await target.load();
    const redisDelSpy = vi.spyOn(redisCache, 'del');
    const memoryDelSpy = vi.spyOn(memoryCache, 'del');

    await target.clear();

    expect(redisDelSpy).toHaveBeenCalledWith('evict-key');
    expect(memoryDelSpy).not.toHaveBeenCalled();
    expect(service.list().find(e => e.key === 'evict-key')).toBeUndefined();
  });
});
