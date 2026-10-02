import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';

import { ServiceLogger } from '@codeshore/service-logger';

import { cacheALS } from './cache-context';
import { REDIS_CACHE } from './redis-cache.provider';

/** Which underlying store a cache entry is read from / written to. */
export type CacheBackend = 'memory' | 'redis';

export interface CacheGetOrSetOptions {
  ttl?: number; // seconds; undefined = no expiry
  backend?: CacheBackend; // default 'memory'
}

interface CacheEntryMeta {
  createdAt: number; // epoch ms
  ttl?: number; // ms; undefined = no expiry
  size: number; // approximate serialized size in bytes
  backend: CacheBackend; // which backend this entry was written to
}

export interface CacheEntryInfo {
  key: string;
  createdAt: string; // ISO timestamp of when the entry was written
  ageSeconds: number; // how long the entry has lived
  ttlSeconds: number | null; // configured ttl, null = no expiry
  expiresAt: string | null; // ISO timestamp, null = no expiry
  remainingSeconds: number | null; // time until expiry, null = no expiry
  size: number; // approximate size in bytes
  sizeHuman: string; // human readable size, e.g. "1.2 KB"
  backend: CacheBackend; // which backend this entry is stored on
}

@Injectable()
export class CacheService implements OnModuleInit {
  private static _instance: CacheService;

  /** Metadata for every live entry, keyed by cache key. */
  private readonly meta = new Map<string, CacheEntryMeta>();

  static get global(): CacheService {
    return CacheService._instance;
  }

  constructor(
    @Inject(CACHE_MANAGER) private readonly memoryCache: Cache,
    @Optional()
    @Inject(REDIS_CACHE)
    private readonly redisCache: Cache | undefined,
    @Inject(ServiceLogger) private readonly logger: ServiceLogger,
  ) {}

  onModuleInit() {
    CacheService._instance = this;
  }

  /**
   * Resolves which `Cache` instance a given backend selection maps to.
   * `'memory'` always resolves to the always-available memory cache;
   * `'redis'` resolves to the injected `REDIS_CACHE` instance, which may be
   * `undefined` when Redis is unconfigured or failed to initialize (handled
   * by task 2.2's degradation logic, not here).
   */
  private resolveCache(backend: CacheBackend): Cache | undefined {
    return backend === 'redis' ? this.redisCache : this.memoryCache;
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    opts?: CacheGetOrSetOptions,
  ): Promise<T> {
    const backend = opts?.backend ?? 'memory';

    if (backend === 'memory') {
      return this.getOrSetOnCache(key, fn, opts, this.memoryCache, 'memory');
    }

    const redisCache = this.resolveCache('redis');
    if (!redisCache) {
      // Redis is unconfigured or failed to initialize. Per `.env.template`'s
      // documented contract (Req 4.2/5.1/5.2): degrade to the memory cache
      // instead of skipping the cache entirely.
      this.logger.warn(
        'Redis cache backend unavailable; degrading to memory cache.',
        { key },
      );
      return this.getOrSetOnCache(key, fn, opts, this.memoryCache, 'memory');
    }

    let cached: T | null | undefined;
    try {
      cached = await redisCache.get<T>(key);
    } catch (error) {
      // Req 5.1/5.2: a runtime Redis failure degrades to the memory cache
      // rather than skipping the cache entirely.
      this.logger.warn(
        'Redis cache backend read failed; degrading to memory cache.',
        { key, error: error instanceof Error ? error.message : error },
      );
      return this.getOrSetOnCache(key, fn, opts, this.memoryCache, 'memory');
    }

    if (cached !== null && cached !== undefined) {
      const store = cacheALS.getStore();
      if (store) store.cacheStatus = 'HIT';
      return cached;
    }

    const store = cacheALS.getStore();
    if (store) store.cacheStatus = 'MISS';
    // `fn()` is intentionally called outside any try/catch guarding the
    // cache operations: the caller's own logic failing is a completely
    // different failure mode and must always propagate unchanged, never be
    // swallowed or reinterpreted as a cache degradation.
    const result = await fn();

    try {
      await redisCache.set(key, result, opts?.ttl);
      this.meta.set(key, {
        createdAt: Date.now(),
        ttl: opts?.ttl,
        size: byteSize(result),
        backend: 'redis',
      });
    } catch (error) {
      // Req 5.1/5.2: the write failed, so the already-computed result is
      // written into the memory cache instead -- the caller still gets
      // their correct result, and the next read can still be a hit.
      this.logger.warn(
        'Redis cache backend write failed; degrading to memory cache.',
        { key, error: error instanceof Error ? error.message : error },
      );
      await this.memoryCache.set(key, result, opts?.ttl);
      this.meta.set(key, {
        createdAt: Date.now(),
        ttl: opts?.ttl,
        size: byteSize(result),
        backend: 'memory',
      });
    }

    return result;
  }

  /**
   * Runs the get-or-set flow against a single, already-resolved `Cache`
   * instance, with no error handling of its own. Used directly for
   * `backend: 'memory'` (which never had error handling and must not gain
   * any), and reused as the Redis degradation target so a degraded entry
   * goes through the exact same hit/miss/write logic -- including being a
   * genuine `HIT` on a later call -- as a normal memory-backed entry.
   */
  private async getOrSetOnCache<T>(
    key: string,
    fn: () => Promise<T>,
    opts: CacheGetOrSetOptions | undefined,
    cache: Cache,
    backend: CacheBackend,
  ): Promise<T> {
    const cached = await cache.get<T>(key);

    if (cached !== null && cached !== undefined) {
      const store = cacheALS.getStore();
      if (store) store.cacheStatus = 'HIT';
      return cached;
    }

    const store = cacheALS.getStore();
    if (store) store.cacheStatus = 'MISS';
    const result = await fn();

    await cache.set(key, result, opts?.ttl);
    this.meta.set(key, {
      createdAt: Date.now(),
      ttl: opts?.ttl,
      size: byteSize(result),
      backend,
    });

    return result;
  }

  async invalidate(keys: string | string[]): Promise<string[]> {
    const list = Array.isArray(keys) ? keys : [keys];
    await Promise.all(
      list.map(async k => {
        const backend = this.meta.get(k)?.backend ?? 'memory';
        const cache = this.resolveCache(backend);
        if (!cache) {
          // Only reachable for `backend === 'redis'` when Redis is
          // unconfigured or unavailable -- there's nothing to delete, treat
          // the key as already gone (Req 6.2).
          return;
        }
        try {
          await cache.del(k);
        } catch (error) {
          if (backend === 'redis') {
            // Req 5.1/5.2-style degradation: don't let one key's Redis
            // failure abort clearing the rest of the batch.
            this.logger.warn('Redis cache backend delete failed; skipping.', {
              key: k,
              error: error instanceof Error ? error.message : error,
            });
            return;
          }
          // 'memory' never had error handling before this feature and must
          // not gain any now -- propagate exactly as before.
          throw error;
        }
      }),
    );
    list.forEach(k => this.meta.delete(k));
    return list;
  }

  async invalidateAll(): Promise<string[]> {
    return this.invalidate([...this.meta.keys()]);
  }

  /**
   * Snapshot of all live cache entries with their write time and size.
   * Entries past their ttl are pruned lazily and excluded from the result.
   */
  list(): CacheEntryInfo[] {
    const now = Date.now();
    const result: CacheEntryInfo[] = [];
    for (const [key, m] of this.meta) {
      const expiresAtMs = this.expiresAtMsOf(m);
      if (expiresAtMs != null && expiresAtMs <= now) {
        this.meta.delete(key);
        continue;
      }
      result.push({
        key,
        createdAt: new Date(m.createdAt).toISOString(),
        ageSeconds: Math.round((now - m.createdAt) / 1000),
        ttlSeconds: m.ttl != null ? Math.round(m.ttl / 1000) : null,
        expiresAt: expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null,
        remainingSeconds:
          expiresAtMs != null ? Math.round((expiresAtMs - now) / 1000) : null,
        size: m.size,
        sizeHuman: humanSize(m.size),
        backend: m.backend,
      });
    }
    return result;
  }

  /**
   * `meta` only tracks bookkeeping for this admin `list()`/size-stats view
   * -- the real cache-manager store already expires entries on its own via
   * the `ttl` passed to `cache.set()`. Without this, `meta` would grow
   * unboundedly for any key nobody ever calls `list()`/`invalidate()` on
   * again after it expires (e.g. a one-off admin lookup that's never
   * repeated). `list()` already prunes lazily on read; this just makes sure
   * pruning happens even if nobody calls `list()` for a while.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  private pruneExpiredMeta(): void {
    const now = Date.now();
    for (const [key, m] of this.meta) {
      const expiresAtMs = this.expiresAtMsOf(m);
      if (expiresAtMs != null && expiresAtMs <= now) {
        this.meta.delete(key);
      }
    }
  }

  private expiresAtMsOf(m: CacheEntryMeta): number | null {
    return m.ttl != null ? m.createdAt + m.ttl : null;
  }
}

function byteSize(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? 0 : Buffer.byteLength(json, 'utf8');
  } catch {
    return 0;
  }
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
