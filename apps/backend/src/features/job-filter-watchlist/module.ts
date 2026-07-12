import { Module as ModuleDecorator } from '@nestjs/common';

import { JobFilterSubscriptionService, MvJobService } from '@codeshore/data-utils';

import { provideWithLogger } from '../logger-provider';
import { Controller } from './controller';
import { Service } from './service';

/**
 * Wires the job-filter-watchlist feature's REST surface (design.md "File
 * Structure Plan"). Mirrors `job/module.ts`'s exact pattern: `Service` is a
 * plain provider (no logger dependency of its own), while
 * `JobFilterSubscriptionService`/`MvJobService` -- both `TableService`
 * subclasses taking an optional `ServiceLogger` constructor arg -- are
 * registered via `provideWithLogger` so Nest resolves their logger from the
 * globally-registered `LoggerModule` (see `app.module.ts`). `CacheService`
 * needs no local provider: `ServiceCacheModule` (`getAppCacheModule()`) is
 * `@Global()` and already imported once in `app.module.ts`.
 */
@ModuleDecorator({
  imports: [],
  controllers: [Controller],
  providers: [
    Service,
    provideWithLogger(JobFilterSubscriptionService),
    provideWithLogger(MvJobService),
  ],
})
export class Module {}
