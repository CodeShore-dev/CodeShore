import 'reflect-metadata';

import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Controller } from './controller';
import { Module as KeywordCurationModule } from './module';

/**
 * Task 1.2 completion criterion: "NestJS 伺服器啟動無錯誤；GET
 * /keyword-curation/queue 回傳 401（未授權），驗證 guard 生效".
 *
 * Repo test-harness survey before writing this file: no `apps/backend-e2e`
 * project, no `supertest` dependency, and no existing `*.e2e-spec.ts` /
 * HTTP-level guard-integration test convention anywhere in this backend
 * (`grep -r "supertest\|createTestingModule\|NestFactory" apps/backend/src`
 * returned nothing before this task). Guard behavior is instead unit-tested
 * directly against fake `ExecutionContext`s -- see `../auth/auth.guard.spec.ts`,
 * which constructs `new AuthGuard(new Reflector())` and a hand-built
 * `ExecutionContext` rather than booting a real HTTP server. This test
 * follows that exact repo convention, applied to this feature's real,
 * already-decorated `Controller` class.
 *
 * A `Test.createTestingModule({ imports: [AuthModule, KeywordCurationModule] })`
 * + `app.listen()` + real `fetch()` HTTP call was attempted first (matching
 * design.md's literal HTTP contract) but had to be abandoned: it resolves
 * with a 500, not 401, because this repo's Vitest pipeline (Vite/esbuild)
 * does not emit TypeScript's `design:paramtypes` decorator metadata, so
 * Nest's automatic constructor-injection-by-type silently constructs
 * `AuthGuard` with `reflector` left `undefined` at request time (a
 * pre-existing environment gap, not something introduced by this task --
 * consistent with zero existing DI-`compile()`-based HTTP tests anywhere in
 * this backend). `SetMetadata`-based decorators (`@AdminOnly()`, `@Public()`,
 * etc.) are unaffected because they attach metadata directly at
 * class-decoration time via `Reflect.defineMetadata`, independent of
 * `design:paramtypes` reflection -- which is what makes the approach below
 * reliable.
 */
describe('KeywordCuration Controller guard wiring', () => {
  function makeContext(
    handler: (...args: unknown[]) => unknown,
    options: {
      headers?: Record<string, string>;
      query?: Record<string, string>;
      user?: { email?: string };
    } = {},
  ): ExecutionContext {
    const request = {
      headers: options.headers ?? {},
      query: options.query ?? {},
      user: options.user,
    };

    return {
      getHandler: () => handler,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  describe('AuthGuard (registered globally via AuthModule, requirement 2.1)', () => {
    let guard: AuthGuard;

    beforeEach(() => {
      guard = new AuthGuard(new Reflector());
    });

    it('rejects an unauthenticated GET /keyword-curation/queue with 401 (UnauthorizedException)', async () => {
      const context = makeContext(Controller.prototype.getQueue);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing bearer token',
      );
    });

    it('rejects an unauthenticated POST /keyword-curation/session with 401', async () => {
      const context = makeContext(Controller.prototype.startSession);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an unauthenticated POST /keyword-curation/session/:threadId/resume with 401', async () => {
      const context = makeContext(Controller.prototype.resumeSession);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('@AdminOnly() applied at the Controller class level', () => {
    const originalAdminEmails = process.env['ADMIN_EMAILS'];

    beforeEach(() => {
      process.env['ADMIN_EMAILS'] = 'admin@example.com';
    });

    afterEach(() => {
      if (originalAdminEmails === undefined) {
        delete process.env['ADMIN_EMAILS'];
      } else {
        process.env['ADMIN_EMAILS'] = originalAdminEmails;
      }
    });

    it('rejects an authenticated-but-non-admin GET /keyword-curation/queue with 403 (ForbiddenException)', () => {
      const guard = new AdminGuard(new Reflector());
      const context = makeContext(Controller.prototype.getQueue, {
        user: { email: 'not-admin@example.com' },
      });

      expect(() => guard.canActivate(context)).toThrow(
        'This action is restricted to admin users',
      );
    });

    it('allows an admin through to GET /keyword-curation/queue', () => {
      const guard = new AdminGuard(new Reflector());
      const context = makeContext(Controller.prototype.getQueue, {
        user: { email: 'admin@example.com' },
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  it('boots KeywordCurationModule (Controller + Service wiring) without error', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [KeywordCurationModule],
    }).compile();

    expect(moduleRef.get(Controller)).toBeInstanceOf(Controller);

    await moduleRef.close();
  });
});
