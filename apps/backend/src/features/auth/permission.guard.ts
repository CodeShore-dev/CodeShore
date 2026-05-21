import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@supabase/supabase-js';
import { Request } from 'express';

import { REQUIRE_PERMISSION_KEY } from './auth.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<boolean>(
        REQUIRE_PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      );
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const email = request.user?.email ?? '';

    const adminEmails = (process.env['ADMIN_EMAILS'] ?? '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    // If no list is configured, allow all authenticated users
    if (!adminEmails.length) return true;

    if (!adminEmails.includes(email)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
