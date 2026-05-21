import { CacheService } from './cache.service';

export interface CacheableOptions {
  key: string;
  ttl?: number; // seconds; undefined = no expiry
}

export interface CacheEvictOptions {
  keys: string | string[];
}

export function Cacheable(opts: CacheableOptions) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const original: (...args: unknown[]) => Promise<unknown> = descriptor.value;
    descriptor.value = async function (
      this: { cacheService?: CacheService },
      ...args: unknown[]
    ) {
      const cs = this.cacheService ?? CacheService.global;
      return cs.getOrSet(
        opts.key,
        () => original.apply(this, args),
        { ttl: typeof opts.ttl === 'number' ? opts.ttl * 1000 : undefined },
      );
    };
    return descriptor;
  };
}

export function CacheEvict(opts: CacheEvictOptions) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const original: (...args: unknown[]) => Promise<unknown> = descriptor.value;
    descriptor.value = async function (
      this: { cacheService?: CacheService },
      ...args: unknown[]
    ) {
      const result = await original.apply(this, args);
      const cs = this.cacheService ?? CacheService.global;
      await cs.invalidate(opts.keys);
      return result;
    };
    return descriptor;
  };
}
