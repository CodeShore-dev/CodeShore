import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@supabase/supabase-js';
import { Request } from 'express';

import { isAdminEmail } from './adminEmails';
import { ADMIN_ONLY_KEY } from './auth.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const email = request.user?.email ?? '';

    if (!isAdminEmail(email)) {
      throw new ForbiddenException(
        'This action is restricted to admin users',
      );
    }

    return true;
  }
}
