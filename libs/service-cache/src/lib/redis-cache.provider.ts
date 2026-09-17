import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';
import { Cache, createCache } from 'cache-manager';
import { Keyv } from 'keyv';

import { ServiceLogger } from '@codeshore/service-logger';

/** DI token for the optional Redis-backed `Cache` instance. */
export const REDIS_CACHE = Symbol('REDIS_CACHE');

const VALID_PROTOCOLS = new Set(['redis:', 'rediss:']);

/**
 * Reads and validates `REDIS_URL`, then builds a Redis-backed `cache-manager`
 * `Cache` instance. Every failure mode (missing config, malformed config,
 * connection-level errors after construction) degrades to a logged warning
 * -- never a thrown exception -- so a Redis Cloud outage or misconfiguration
 * can never prevent the application from starting or crash the process
 * (Req 4.1, 4.2).
 *
 * The `error` listener is attached to the `Keyv` instance *before* it is
 * wrapped/returned, not just around individual `get`/`set` calls elsewhere:
 * the underlying Redis client emits `'error'` on connection failure as a
 * standalone event, which is a different failure mode than a single
 * operation's promise rejecting and is not caught by a try/catch around
 * `cache.get()`/`cache.set()` (see research.md section 4).
 */
export function buildRedisCache(
  config: ConfigService,
  logger: ServiceLogger,
): Cache | undefined {
  const url = config.get<string>('REDIS_URL');

  if (!url) {
    logger.warn(
      'Redis cache backend disabled: REDIS_URL is not configured.',
    );
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    logger.warn(
      'Redis cache backend disabled: REDIS_URL is not a valid URL.',
    );
    return undefined;
  }

  if (!VALID_PROTOCOLS.has(parsed.protocol)) {
    logger.warn(
      'Redis cache backend disabled: REDIS_URL must use the redis: or rediss: protocol.',
      { protocol: parsed.protocol },
    );
    return undefined;
  }

  const keyv = new Keyv({ store: new KeyvRedis(url) });
  keyv.on('error', (error: unknown) => {
    logger.warn('Redis cache backend connection error.', {
      error: error instanceof Error ? error.message : error,
    });
  });

  return createCache({ stores: [keyv] });
}

export const redisCacheProvider: Provider = {
  provide: REDIS_CACHE,
  useFactory: buildRedisCache,
  inject: [ConfigService, ServiceLogger],
};
