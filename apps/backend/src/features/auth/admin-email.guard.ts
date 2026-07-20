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

/**
 * Shared canActivate for guards that gate a route behind isAdminEmail() based
 * on a boolean metadata flag. AdminGuard and PermissionGuard both extend this
 * with their own metadata key + message, since they're expected to diverge in
 * meaning later (pure admin-only vs a finer-grained permission check) even
 * though the underlying check is identical today.
 */
@Injectable()
export abstract class AdminEmailGuard implements CanActivate {
  protected abstract readonly metadataKey: string;
  protected abstract readonly forbiddenMessage: string;

  constructor(protected readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(this.metadataKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const email = request.user?.email ?? '';

    if (!isAdminEmail(email)) {
      throw new ForbiddenException(this.forbiddenMessage);
    }

    return true;
  }
}
