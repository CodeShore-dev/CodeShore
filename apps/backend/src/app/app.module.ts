import { Module } from '@nestjs/common';

import {
  MvTechRankingService,
  MvSalaryTypeMedianRatioService,
  MvSalaryRangeMultiplierService,
  MvTechComboStatsService,
} from '@codeshore/data-utils';
import { getAppCacheModule } from '@codeshore/service-cache';
import { LoggerModule } from '@codeshore/service-logger';
import { getServeStaticModule } from '@codeshore/service-serve-static';

import { Module as AdminModule } from '../features/admin/module';
import { AuthModule } from '../features/auth/auth.module';
import { Module as CacheModule } from '../features/cache/module';
import { Module as CompanyModule } from '../features/company/module';
import { Module as JobModule } from '../features/job/module';
import { Module as KeywordModule } from '../features/keyword/module';
import { provideWithLogger } from '../features/logger-provider';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    getAppCacheModule(),
    getServeStaticModule(process.env.REPO),
    LoggerModule.forRoot(),
    AuthModule,
    CacheModule,
    CompanyModule,
    JobModule,
    KeywordModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    provideWithLogger(MvSalaryTypeMedianRatioService),
    provideWithLogger(MvSalaryRangeMultiplierService),
    provideWithLogger(MvTechRankingService),
    provideWithLogger(MvTechComboStatsService),
  ],
})
export class AppModule {}
