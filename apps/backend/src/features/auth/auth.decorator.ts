import {
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const ADMIN_ONLY_KEY = 'adminOnly';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermission = () =>
  SetMetadata(REQUIRE_PERMISSION_KEY, true);
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as Request & { user: unknown }).user;
  },
);

export const CurrentUserToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    return authHeader?.split(' ')[1];
  },
);
