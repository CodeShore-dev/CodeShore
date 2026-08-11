import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CacheService } from './cache.service';
import { REDIS_CACHE, redisCacheProvider } from './redis-cache.provider';

@Global()
@Module({
  imports: [ConfigModule, CacheModule.register({ isGlobal: true })],
  providers: [CacheService, redisCacheProvider],
  exports: [CacheService, REDIS_CACHE],
})
export class ServiceCacheModule {}

export const getAppCacheModule = (): typeof ServiceCacheModule =>
  ServiceCacheModule;
