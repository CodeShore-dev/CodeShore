import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { QUERY_LIMIT_KEY } from './query-limit.decorator';

@Injectable()
export class QueryLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const maxTo = this.reflector.getAllAndOverride<number>(QUERY_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (maxTo === undefined) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const toParam = request.query['to'];

    if (toParam === undefined) return true;

    const to = Number(toParam);

    if (isNaN(to) || to < 0 || to > maxTo) {
      throw new BadRequestException(
        `Query parameter "to" must be between 0 and ${maxTo}`,
      );
    }

    return true;
  }
}
