import 'reflect-metadata';

import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { ADMIN_ONLY_KEY, IS_PUBLIC_KEY } from '../features/auth/auth.decorator';
import { AuthGuard } from '../features/auth/auth.guard';
import { AppController } from './app.controller';

/**
 * Task 2 (methodology-ai-transparency): this is the first spec file for
 * `AppController` in this repo, and it is scoped ONLY to the newly-added
 * `GET /methodology/ai-workflows` route -- it does not retroactively test
 * any pre-existing route on this controller.
 *
 * Follows the repo's established guard-verification convention (see
 * `features/keyword-curation/controller.spec.ts`'s "KeywordCuration
 * Controller guard wiring" describe block): guard behavior is unit-tested
 * directly against a hand-built `ExecutionContext`, rather than booting a
 * real HTTP server, because this Vitest/esbuild pipeline does not emit
 * `design:paramtypes` decorator metadata needed for Nest's automatic
 * constructor-injection-by-type at request time.
 */
describe('AppController.getAiWorkflows (task 2)', () => {
  function makeContext(
    handler: (...args: unknown[]) => unknown,
    options: { headers?: Record<string, string> } = {},
  ): ExecutionContext {
    const request = {
      headers: options.headers ?? {},
      query: {},
    };

    return {
      getHandler: () => handler,
      getClass: () => AppController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('delegates to AppService.getAiWorkflows() and returns its result verbatim', () => {
    const aiWorkflowsResponse = {
      aiSuggestion: [{ workflow: 'keyword_mapping', label: '關鍵字對應技術', steps: [] }],
      keywordCuration: {
        toolName: 'classify_keyword',
        systemPrompt: 'system prompt text',
        inputSchema: { type: 'object' },
        paths: [{ path: 'A', label: '映射至既有技術條目' }],
      },
    };
    const service = { getAiWorkflows: vi.fn().mockReturnValue(aiWorkflowsResponse) };
    const controller = new AppController(service as any);

    const response = controller.getAiWorkflows();

    expect(service.getAiWorkflows).toHaveBeenCalledWith();
    expect(response).toBe(aiWorkflowsResponse);
  });

  it('carries the class-level @Public() metadata onto the new route (requirement 1.3)', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AppController);
    expect(isPublic).toBe(true);
  });

  it('has no @AdminOnly() (or other permission) metadata on the getAiWorkflows handler (requirement 4.2)', () => {
    const adminOnly = Reflect.getMetadata(
      ADMIN_ONLY_KEY,
      AppController.prototype.getAiWorkflows,
    );
    expect(adminOnly).toBeUndefined();
  });

  it('AuthGuard allows an unauthenticated request straight through, thanks to @Public() (requirement 1.3, 200 with no token)', async () => {
    const guard = new AuthGuard(new Reflector());
    const context = makeContext(AppController.prototype.getAiWorkflows);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
