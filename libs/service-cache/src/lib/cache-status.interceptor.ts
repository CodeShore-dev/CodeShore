import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { cacheAls } from './cache-context';

@Injectable()
export class CacheStatusInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse();
    const store: { cacheStatus?: 'HIT' | 'MISS' } = {};

    return new Observable(observer => {
      cacheAls.run(store, () => {
        next
          .handle()
          .pipe(
            tap(() => {
              if (store.cacheStatus) {
                response.setHeader('X-Cache', store.cacheStatus);
              }
            }),
          )
          .subscribe(observer);
      });
    });
  }
}
