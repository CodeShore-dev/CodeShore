import 'reflect-metadata';

import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('@codeshore/supabase', () => ({
  getSupabaseClient: () => ({ auth: { getUser: (token: string) => getUser(token) } }),
}));

import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from './auth.decorator';
import { AuthGuard } from './auth.guard';

interface FakeRequest {
  headers: Record<string, string>;
  query: Record<string, string>;
  user?: unknown;
}

function makeContext(options: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  isPublic?: boolean;
  isOptionalAuth?: boolean;
}): { context: ExecutionContext; request: FakeRequest } {
  const request: FakeRequest = {
    headers: options.headers ?? {},
    query: options.query ?? {},
  };
  const handler = function handler() {
    return undefined;
  };
  if (options.isPublic) Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
  if (options.isOptionalAuth) {
    Reflect.defineMetadata(IS_OPTIONAL_AUTH_KEY, true, handler);
  }

  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

const testUser = { id: 'u1', email: 'a@b.com' };

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    getUser.mockReset();
    guard = new AuthGuard(new Reflector());
  });

  it('allows a @Public() route through with no token check at all', async () => {
    const { context, request } = makeContext({ isPublic: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getUser).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  describe('@OptionalAuth() route', () => {
    it('allows a request with no token through as a guest', async () => {
      const { context, request } = makeContext({ isOptionalAuth: true });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(getUser).not.toHaveBeenCalled();
      expect(request.user).toBeUndefined();
    });

    it('attaches the user when a valid bearer token is present', async () => {
      getUser.mockResolvedValue({ data: { user: testUser }, error: null });
      const { context, request } = makeContext({
        isOptionalAuth: true,
        headers: { authorization: 'Bearer valid-token' },
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(getUser).toHaveBeenCalledWith('valid-token');
      expect(request.user).toEqual(testUser);
    });

    it('falls back to guest (no throw) when the token is invalid or expired', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('expired'),
      });
      const { context, request } = makeContext({
        isOptionalAuth: true,
        headers: { authorization: 'Bearer stale-token' },
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toBeUndefined();
    });
  });

  describe('protected route (no decorator)', () => {
    it('rejects a request with no token', async () => {
      const { context } = makeContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing bearer token',
      );
      expect(getUser).not.toHaveBeenCalled();
    });

    it('rejects a request with an invalid or expired token', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('expired'),
      });
      const { context } = makeContext({
        headers: { authorization: 'Bearer stale-token' },
      });
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('attaches the user and allows the request through for a valid token', async () => {
      getUser.mockResolvedValue({ data: { user: testUser }, error: null });
      const { context, request } = makeContext({
        headers: { authorization: 'Bearer valid-token' },
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toEqual(testUser);
    });

    it('accepts a token passed via the query string', async () => {
      getUser.mockResolvedValue({ data: { user: testUser }, error: null });
      const { context, request } = makeContext({
        query: { token: 'query-token' },
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(getUser).toHaveBeenCalledWith('query-token');
      expect(request.user).toEqual(testUser);
    });
  });
});
