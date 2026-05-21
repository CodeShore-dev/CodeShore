import { AsyncLocalStorage } from 'node:async_hooks';

export interface CacheRequestStore {
  cacheStatus?: 'HIT' | 'MISS';
}

export const cacheAls = new AsyncLocalStorage<CacheRequestStore>();
