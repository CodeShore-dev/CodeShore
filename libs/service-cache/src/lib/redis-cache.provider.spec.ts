/**
 * `@keyv/redis` is mocked with a self-contained fake store class so these
 * tests never attempt a real network connection to Redis Cloud -- no live
 * instance is available in this environment. The fake implements the
 * minimal shape `keyv`'s real `Keyv` class requires of a storage adapter
 * (`get`/`set`/`delete`/`clear`/`on`) so wrapping it in a real `Keyv`
 * instance (also real, not mocked) exercises the actual error-relay wiring:
 * `keyv`'s `Keyv` forwards `store.on('error', ...)` to its own `'error'`
 * event (verified by reading `node_modules/keyv/dist/index.cjs`), so
 * triggering the fake store's error listener is a faithful stand-in for a
 * real Redis connection failure.
 *
 * The vi.mock factory below is fully self-contained (no references to
 * outer-scope bindings) specifically to avoid hoisting/TDZ pitfalls, per
 * Vitest's hoisting behavior for vi.mock().
 */
import type { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';

vi.mock('@keyv/redis', () => {
  class FakeKeyvRedisStore {
    static instances: FakeKeyvRedisStore[] = [];

    readonly url?: string;

    private readonly listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

    constructor(url?: string) {
      this.url = url;
      FakeKeyvRedisStore.instances.push(this);
    }

    on(event: string, cb: (...args: unknown[]) => void) {
      (this.listeners[event] ??= []).push(cb);
      return this;
    }

    triggerError(error: unknown) {
      (this.listeners['error'] ?? []).forEach(cb => cb(error));
    }

    get() {
      return Promise.resolve(undefined);
    }

    set() {
      return Promise.resolve();
    }

    delete() {
      return Promise.resolve(true);
    }

    clear() {
      return Promise.resolve();
    }
  }

  return { default: FakeKeyvRedisStore };
});

import KeyvRedis from '@keyv/redis';

import { buildRedisCache } from './redis-cache.provider';

type FakeKeyvRedisStoreCtor = {
  instances: Array<{ triggerError(error: unknown): void; url?: string }>;
};

function fakeStoreCtor(): FakeKeyvRedisStoreCtor {
  return KeyvRedis as unknown as FakeKeyvRedisStoreCtor;
}

function fakeConfig(redisUrl: string | undefined): ConfigService {
  return {
    get: vi.fn().mockReturnValue(redisUrl),
  } as unknown as ConfigService;
}

function fakeLogger() {
  return { warn: vi.fn() };
}

beforeEach(() => {
  fakeStoreCtor().instances.length = 0;
});

describe('buildRedisCache', () => {
  it('returns undefined and logs a warning when REDIS_URL is missing', () => {
    const logger = fakeLogger();

    const cache = buildRedisCache(fakeConfig(undefined), logger as never);

    expect(cache).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('REDIS_URL'));
  });

  it('returns undefined and logs a warning when REDIS_URL is not a valid URL', () => {
    const logger = fakeLogger();

    const cache = buildRedisCache(fakeConfig('not a url'), logger as never);

    expect(cache).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('REDIS_URL'));
  });

  it('returns undefined and logs a warning when REDIS_URL uses an unsupported protocol', () => {
    const logger = fakeLogger();

    const cache = buildRedisCache(
      fakeConfig('http://user:pass@localhost:6379'),
      logger as never,
    );

    expect(cache).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('REDIS_URL'),
      expect.objectContaining({ protocol: 'http:' }),
    );
  });

  it('returns a defined Cache-shaped object for a valid redis: URL, without logging a warning', () => {
    const logger = fakeLogger();

    const cache = buildRedisCache(
      fakeConfig('redis://user:pass@localhost:6379'),
      logger as never,
    );

    expect(cache).toBeDefined();
    expect(typeof (cache as Cache).get).toBe('function');
    expect(typeof (cache as Cache).set).toBe('function');
    expect(typeof (cache as Cache).del).toBe('function');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns a defined Cache-shaped object for a valid rediss: URL', () => {
    const cache = buildRedisCache(
      fakeConfig('rediss://user:pass@redis-cloud-host:6380'),
      fakeLogger() as never,
    );

    expect(cache).toBeDefined();
  });

  it('does not throw when the underlying store emits an error event after construction', () => {
    const logger = fakeLogger();

    const cache = buildRedisCache(
      fakeConfig('redis://user:pass@localhost:6379'),
      logger as never,
    );
    expect(cache).toBeDefined();

    const [store] = fakeStoreCtor().instances;
    expect(store).toBeDefined();

    expect(() => store.triggerError(new Error('ECONNREFUSED'))).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      'Redis cache backend connection error.',
      expect.objectContaining({ error: 'ECONNREFUSED' }),
    );
  });
});
