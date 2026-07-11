import 'reflect-metadata';

import type { ExecutionContext } from '@nestjs/common';
import { InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoggerModule } from '@codeshore/service-logger';

import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Controller } from './controller';
import { KeywordCurationGraph } from './graph';
import { Module as KeywordCurationModule } from './module';
import { Service } from './service';

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
    // Task 4.1 added `provideWithLogger(...)`-registered data-utils
    // providers (`KeywordService` etc.) to `module.ts`, each requiring a
    // constructor-injected `ServiceLogger` -- the same `@Global()`
    // `LoggerModule` every other feature module implicitly relies on via
    // `app.module.ts`'s `LoggerModule.forRoot()` import. This isolated
    // `KeywordCurationModule`-only test doesn't go through `app.module.ts`,
    // so it must import `LoggerModule.forRoot()` itself to supply that
    // dependency, mirroring `app.module.ts`'s own usage.
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), KeywordCurationModule],
    }).compile();

    expect(moduleRef.get(Controller)).toBeInstanceOf(Controller);

    await moduleRef.close();
  });

  /**
   * Task 4.2's central architectural constraint: `KeywordCurationGraph`'s
   * compiled `app`/`MemorySaver` must be a single, stable DI singleton
   * actually wired into `Service`, not left `undefined` -- which is exactly
   * what would silently happen if any of the graph's `Pick<X, 'method'>`-typed
   * node constructors were registered as bare classes instead of explicit
   * `useFactory`/`inject` providers (see `module.ts`'s doc comment: under
   * this repo's `tsc --emitDecoratorMetadata` build, `Pick<X, K>` params
   * erase to `Object` in `design:paramtypes`, and Nest's automatic
   * constructor-injection-by-type cannot resolve that). This test proves the
   * whole chain -- `KeywordCurationGraph` down through `CurationLlmClassifier`,
   * `DynamicLlmClient`, and every graph node -- resolves to real instances,
   * and that `Service` actually received the same singleton `KeywordCurationGraph`
   * instance the module produced (not a second one, and not `undefined`).
   */
  it('wires a real KeywordCurationGraph singleton into Service (not undefined, not a second instance)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), KeywordCurationModule],
    }).compile();

    const graph = moduleRef.get(KeywordCurationGraph);
    const service = moduleRef.get(Service);

    expect(graph).toBeInstanceOf(KeywordCurationGraph);
    expect(graph.app).toBeDefined();
    // `graph` is constructor-injected as `private readonly` -- TypeScript's
    // `private` is compile-time only, so it is still a real own property on
    // the instance at runtime and can be asserted on directly here.
    expect((service as unknown as { graph: unknown }).graph).toBe(graph);

    await moduleRef.close();
  });
});

/**
 * Task 4.2 completion criteria: direct unit tests of `Controller.startSession`/
 * `Controller.resumeSession`'s HTTP-mapping logic, constructing `Controller`
 * directly with a mocked `Service` (same lightweight pattern as
 * `service.spec.ts`'s `createService`, rather than booting the full Nest
 * module) -- proves the 404 mapping for `thread_not_found`, the 500 mapping
 * for `graph_error`, and the exact `{ status: 'done', result }` /
 * `{ threadId, interrupt }` success response shapes design.md's HTTP
 * contract specifies.
 */
/**
 * Task 8.2 audit gap: `Controller.prototype.getQueue` was only ever
 * referenced to build a fake `ExecutionContext` for the guard-wiring tests
 * above -- no test constructed `new Controller(service)` and actually called
 * `.getQueue()`, unlike `startSession`/`resumeSession` below which each have
 * a dedicated describe block doing exactly that. `Controller.getQueue()` has
 * no HTTP-mapping logic of its own (no error branching, no status-code
 * mapping -- see `controller.ts`: it is a one-line passthrough to
 * `Service.getQueue()`), so this test only proves the wiring, not the filter
 * logic itself (that's exhaustively covered by `service.spec.ts`'s
 * `Service.getQueue` describe block: mapped/keyword_bin/below-threshold
 * exclusion and count-descending order).
 */
describe('Controller.getQueue (task 8.2)', () => {
  it('returns the queue exactly as resolved by Service.getQueue (design.md HTTP contract, 200 response)', async () => {
    const queue = {
      keywords: [
        { id: 'golang', count: 20, affectedJobCount: 12 },
        { id: 'react', count: 15, affectedJobCount: 7 },
      ],
    };
    const service = { getQueue: vi.fn().mockResolvedValue(queue) };
    const controller = new Controller(service as any);

    const response = await controller.getQueue();

    expect(service.getQueue).toHaveBeenCalledWith();
    expect(response).toEqual(queue);
  });

  it('returns an empty keywords array unchanged when the queue has no eligible keyword (requirement 1.3)', async () => {
    const service = { getQueue: vi.fn().mockResolvedValue({ keywords: [] }) };
    const controller = new Controller(service as any);

    const response = await controller.getQueue();

    expect(response).toEqual({ keywords: [] });
  });
});

describe('Controller.startSession (task 4.2)', () => {
  it('returns { threadId, interrupt } on success (design.md HTTP contract, 200 response)', async () => {
    const interrupt = { path: 'C' as const, reasoning: 'not a real technology', affectedJobCount: 3 };
    const service = {
      startSession: vi.fn().mockResolvedValue({ ok: true, threadId: 'thread-1', interrupt }),
    };
    const controller = new Controller(service as any);

    const response = await controller.startSession('blockchain');

    expect(service.startSession).toHaveBeenCalledWith('blockchain');
    expect(response).toEqual({ threadId: 'thread-1', interrupt });
  });

  it('throws InternalServerErrorException when Service.startSession returns ok: false', async () => {
    const service = {
      startSession: vi.fn().mockResolvedValue({ ok: false, error: 'OPENROUTER_API_KEY not configured' }),
    };
    const controller = new Controller(service as any);

    await expect(controller.startSession('blockchain')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    await expect(controller.startSession('blockchain')).rejects.toThrow(
      'OPENROUTER_API_KEY not configured',
    );
  });
});

describe('Controller.resumeSession (task 4.2)', () => {
  it("returns { status: 'done', result } on success (design.md HTTP contract, 200 response)", async () => {
    const commitResult = {
      ok: true as const,
      changes: [{ type: 'keyword_bin' as const, details: { id: 'blockchain' }, status: 'committed' as const }],
    };
    const service = {
      resumeSession: vi.fn().mockResolvedValue({ ok: true, result: commitResult }),
    };
    const controller = new Controller(service as any);
    const decision = { path: 'C' as const };

    const response = await controller.resumeSession('thread-1', decision);

    expect(service.resumeSession).toHaveBeenCalledWith('thread-1', decision);
    expect(response).toEqual({ status: 'done', result: commitResult });
  });

  it('throws NotFoundException (404) when Service.resumeSession reports thread_not_found (design.md HTTP contract, 404 response)', async () => {
    const service = {
      resumeSession: vi.fn().mockResolvedValue({
        ok: false,
        error: 'thread_not_found',
        message: 'No curation session found for threadId "bad-id"',
      }),
    };
    const controller = new Controller(service as any);

    await expect(controller.resumeSession('bad-id', { path: 'C' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(controller.resumeSession('bad-id', { path: 'C' })).rejects.toThrow(
      'No curation session found for threadId "bad-id"',
    );
  });

  it('throws InternalServerErrorException (500) when Service.resumeSession reports graph_error', async () => {
    const service = {
      resumeSession: vi.fn().mockResolvedValue({
        ok: false,
        error: 'graph_error',
        message: 'unexpected commit node failure',
      }),
    };
    const controller = new Controller(service as any);

    await expect(controller.resumeSession('thread-1', { path: 'C' })).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    await expect(controller.resumeSession('thread-1', { path: 'C' })).rejects.toThrow(
      'unexpected commit node failure',
    );
  });
});
