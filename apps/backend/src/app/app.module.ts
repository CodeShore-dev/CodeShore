import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import {
  MvTechRankingService,
  MvSalaryTypeMedianRatioService,
  MvSalaryRangeMultiplierService,
  MvTechComboStatsService,
} from '@codeshore/data-utils';
import { getAppCacheModule } from '@codeshore/service-cache';
import { LoggerModule } from '@codeshore/service-logger';
import { getServeStaticModule } from '@codeshore/service-serve-static';
import { TransportModule } from '@codeshore/service-transport';

import { Module as AdminModule } from '../features/admin/module';
import { Module as AiSuggestionModule } from '../features/ai-suggestion/module';
import { AuthModule } from '../features/auth/auth.module';
import { Module as CacheModule } from '../features/cache/module';
import { Module as CompanyModule } from '../features/company/module';
import { validateEnv } from '../config/environment-variables';
import { Module as HealthModule } from '../features/health/module';
import { Module as JobModule } from '../features/job/module';
import { Module as JobFilterWatchlistModule } from '../features/job-filter-watchlist/module';
import { Module as KeywordModule } from '../features/keyword/module';
import { Module as KeywordCurationModule } from '../features/keyword-curation/module';
import { provideWithLogger } from '../features/logger-provider';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // isGlobal: true so ConfigService is injectable anywhere without each
    // feature module re-importing ConfigModule. `validate` runs once at
    // bootstrap and throws (crashing the process) if a required var like
    // SUPABASE_URL is missing, instead of that surfacing lazily as
    // "Missing Supabase credentials" on the first request that needs it.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Per-IP default: 120 requests / 60s. Public endpoints (job/company
    // listings etc.) had no rate limiting at all before this; admin-only
    // SSE endpoints (crawl/refresh-mv) are already gated by AdminGuard and
    // are low-volume by nature, so one global default covers both without
    // needing a stricter per-route override yet.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    // Powers CacheService's periodic expired-metadata prune (see
    // @codeshore/service-cache's cache.service.ts). Per explicit decision,
    // crawl/refresh-mv stay admin-triggered only -- this is the one
    // @Cron job in the app, and it's purely internal bookkeeping with no
    // external side effects.
    ScheduleModule.forRoot(),
    getAppCacheModule(),
    getServeStaticModule(process.env.REPO),
    LoggerModule.forRoot(),
    TransportModule,
    HealthModule,
    AuthModule,
    CacheModule,
    CompanyModule,
    JobModule,
    JobFilterWatchlistModule,
    KeywordModule,
    AdminModule,
    AiSuggestionModule,
    KeywordCurationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    provideWithLogger(MvSalaryTypeMedianRatioService),
    provideWithLogger(MvSalaryRangeMultiplierService),
    provideWithLogger(MvTechRankingService),
    provideWithLogger(MvTechComboStatsService),
    // Bare useClass is safe here (unlike our own guards, see
    // auth.module.ts's comment): ThrottlerGuard ships as precompiled JS
    // from @nestjs/throttler with its own design:paramtypes already baked
    // in by that package's build, so it doesn't depend on this repo's
    // esbuild/vitest pipeline emitting metadata. Verified directly against
    // this pipeline: a real request sequence returns 200/200/429/429, not
    // a 500 from a broken constructor.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
