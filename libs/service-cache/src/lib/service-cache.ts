import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';

import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [CacheModule.register({ isGlobal: true })],
  providers: [CacheService],
  exports: [CacheService],
})
export class ServiceCacheModule {}

export const getAppCacheModule = (): typeof ServiceCacheModule =>
  ServiceCacheModule;
