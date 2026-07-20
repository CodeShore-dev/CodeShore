import { Module, Provider, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { ServiceLogger } from '@codeshore/service-logger';

import { AllExceptionsFilter } from './all-exceptions.filter';
import { InboundInterceptor } from './inbound.interceptor';

/**
 * Registers the app-wide filter/interceptor/pipe via DI tokens
 * (APP_FILTER/APP_INTERCEPTOR/APP_PIPE) instead of the previous
 * `app.useGlobalXxx(new X())` calls in service-utils.ts. Both approaches
 * apply globally, but only DI registration lets Nest inject dependencies
 * (AllExceptionsFilter needs ServiceLogger) and makes these participate in
 * TestingModule overrides.
 *
 * Registered via useFactory/inject rather than bare useClass, matching this
 * repo's established provider convention (see `provideWithLogger` and the
 * comment in `keyword-curation/module.ts`): the dev/test pipeline (Vite/
 * esbuild) never emits `design:paramtypes`, so a bare `useClass` here would
 * silently construct AllExceptionsFilter/InboundInterceptor with
 * `logger: undefined` under Vitest while working fine in the real
 * `build-lambda` (tsc) build -- exactly the trap that convention exists to
 * avoid.
 */
const exceptionFilterProvider: Provider = {
  provide: APP_FILTER,
  useFactory: (logger: ServiceLogger) => new AllExceptionsFilter(logger),
  inject: [ServiceLogger],
};

const inboundInterceptorProvider: Provider = {
  provide: APP_INTERCEPTOR,
  useFactory: (logger: ServiceLogger) => new InboundInterceptor(logger),
  inject: [ServiceLogger],
};

const validationPipeProvider: Provider = {
  provide: APP_PIPE,
  useFactory: () =>
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
};

@Module({
  providers: [
    exceptionFilterProvider,
    inboundInterceptorProvider,
    validationPipeProvider,
  ],
})
export class TransportModule {}
