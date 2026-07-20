import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cache } from 'cache-manager';

import { cacheALS } from './cache-context';

export interface CacheGetOrSetOptions {
  ttl?: number; // seconds; undefined = no expiry
}

interface CacheEntryMeta {
  createdAt: number; // epoch ms
  ttl?: number; // ms; undefined = no expiry
  size: number; // approximate serialized size in bytes
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
}

@Injectable()
export class CacheService implements OnModuleInit {
  private static _instance: CacheService;

  /** Metadata for every live entry, keyed by cache key. */
  private readonly meta = new Map<string, CacheEntryMeta>();

  static get global(): CacheService {
    return CacheService._instance;
  }

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  onModuleInit() {
    CacheService._instance = this;
  }

  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    opts?: CacheGetOrSetOptions,
  ): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached !== null && cached !== undefined) {
      const store = cacheALS.getStore();
      if (store) store.cacheStatus = 'HIT';
      return cached;
    }
    const store = cacheALS.getStore();
    if (store) store.cacheStatus = 'MISS';
    const result = await fn();
    await this.cache.set(key, result, opts?.ttl);
    this.meta.set(key, {
      createdAt: Date.now(),
      ttl: opts?.ttl,
      size: byteSize(result),
    });
    return result;
  }

  async invalidate(keys: string | string[]): Promise<string[]> {
    const list = Array.isArray(keys) ? keys : [keys];
    await Promise.all(list.map(k => this.cache.del(k)));
    list.forEach(k => this.meta.delete(k));
    return list;
  }

  async invalidateAll(): Promise<string[]> {
    const keys = [...this.meta.keys()];
    await Promise.all(keys.map(k => this.cache.del(k)));
    this.meta.clear();
    return keys;
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
