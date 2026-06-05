import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { cacheALS } from './cache-context';

export interface CacheGetOrSetOptions {
  ttl?: number; // seconds; undefined = no expiry
}

@Injectable()
export class CacheService implements OnModuleInit {
  private static _instance: CacheService;

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
    return result;
  }

  async invalidate(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    await Promise.all(list.map(k => this.cache.del(k)));
  }
}
