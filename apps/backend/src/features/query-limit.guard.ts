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
    const fromParam = request.query['from'];
    const toParam = request.query['to'];

    if (fromParam === undefined || toParam === undefined) return true;

    const to = Number(toParam);
    const from = Number(fromParam);
    const pageSize = to - from;

    if (isNaN(pageSize) || pageSize < 0 || pageSize > maxTo) {
      throw new BadRequestException(
        `The gap between query parameter "from" and "to" must be limited to between 0 and ${maxTo}`,
      );
    }

    return true;
  }
}
