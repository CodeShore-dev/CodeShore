import { Module } from '@nestjs/common';

import { getAppCacheModule } from '@codeshore/service-cache';
import { getAppConfigModule } from '@codeshore/service-config';
import { LoggerModule } from '@codeshore/service-logger';
import { getServeStaticModule } from '@codeshore/service-serve-static';

import { AuthModule } from '../features/auth/auth.module';
import { Module as CompanyModule } from '../features/company/module';
import { Module as JobModule } from '../features/job/module';
import { Module as KeywordModule } from '../features/keyword/module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    getAppCacheModule(),
    getAppConfigModule(),
    getServeStaticModule(process.env.REPO),
    LoggerModule,
    AuthModule,
    CompanyModule,
    JobModule,
    KeywordModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
