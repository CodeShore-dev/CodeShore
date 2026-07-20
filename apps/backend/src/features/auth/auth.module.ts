import { Module, Provider } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';

import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { PermissionGuard } from './permission.guard';
import { QueryLimitGuard } from '../query-limit.guard';

/**
 * All four guards are registered via useFactory/inject instead of bare
 * useClass, for the same reason as `provideWithLogger` and
 * keyword-curation/module.ts's provider factories: this repo's dev/test
 * pipeline (Vite/esbuild) never emits `design:paramtypes`, so Nest's
 * automatic constructor-injection-by-type can't resolve `Reflector` for a
 * bare `useClass` guard here. Confirmed by direct test: with `useClass`,
 * `reflector` comes back `undefined` and every real request crashes with a
 * 500 the moment a guard calls `this.reflector.getAllAndOverride(...)` --
 * it only worked in the actual production build because `build-lambda`
 * compiles with real `tsc` (which does emit the metadata), masking the bug
 * everywhere else (local `serve`, Vitest, CI).
 */
const authGuardProvider: Provider = {
  provide: APP_GUARD,
  useFactory: (reflector: Reflector) => new AuthGuard(reflector),
  inject: [Reflector],
};

const permissionGuardProvider: Provider = {
  provide: APP_GUARD,
  useFactory: (reflector: Reflector) => new PermissionGuard(reflector),
  inject: [Reflector],
};

const queryLimitGuardProvider: Provider = {
  provide: APP_GUARD,
  useFactory: (reflector: Reflector) => new QueryLimitGuard(reflector),
  inject: [Reflector],
};

const adminGuardProvider: Provider = {
  provide: APP_GUARD,
  useFactory: (reflector: Reflector) => new AdminGuard(reflector),
  inject: [Reflector],
};

@Module({
  controllers: [AuthController],
  providers: [
    authGuardProvider,
    permissionGuardProvider,
    queryLimitGuardProvider,
    adminGuardProvider,
  ],
})
export class AuthModule {}
