import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { getSupabaseClient } from '@codeshore/supabase';

import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from './auth.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request) || request.query.token as string;

    if (!token) {
      if (isOptionalAuth) return true;
      throw new UnauthorizedException('Missing bearer token');
    }

    const { data, error } = await getSupabaseClient().auth.getUser(token);

    if (error || !data.user) {
      // Optional-auth routes must keep working for a guest even if a stale
      // or invalid token is present; only strictly-protected routes reject.
      if (isOptionalAuth) return true;
      throw new UnauthorizedException('Invalid or expired token');
    }

    (request as Request & { user: unknown }).user = data.user;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] =
      request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
