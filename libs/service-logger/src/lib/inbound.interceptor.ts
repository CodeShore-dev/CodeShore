import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { cacheAls, CacheRequestStore } from '@codeshore/service-cache';
import { AxiosError } from 'axios';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { ServiceLogger } from './service-logger';

@Injectable()
export class InboundInterceptor implements NestInterceptor {
  constructor(private readonly logger: ServiceLogger) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request_now = new Date();
    const calcLatency = (
      start: Date,
      end: Date,
    ): number => {
      const latency_sec =
        (end.getTime() - start.getTime()) / 1000;
      return latency_sec;
    };

    const stringifyObject = (value: object) => {
      try {
        return Object.keys(value).length > 0
          ? JSON.stringify(value)
          : '';
      } catch {
        return '';
      }
    };

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const userAgent = request.headers?.['user-agent'];
    const traceId = request.headers?.['trace-id'];

    let msgInfo = {
      trace_id: traceId,
      method: request.method,
      path: request.url,
      request_query: stringifyObject(request.query),
      request_params: stringifyObject(request.params),
      request_body: stringifyObject(request.body),
      status: undefined as number | undefined,
      response_body: '',
      latency: 0,
      ip: request.ip,
      'user-agent': userAgent,
      time: request_now.toISOString(),
      direction: 'inbound',
      type: 'request',
      cache_status: undefined as CacheRequestStore['cacheStatus'],
    };

    this.logger.log(msgInfo);

    const cacheStore: CacheRequestStore = {};

    return new Observable(observer => {
      cacheAls.run(cacheStore, () => {
        next.handle().pipe(
      tap(() => {
        const response_now = new Date();

        if (cacheStore.cacheStatus) {
          response.setHeader('X-Cache', cacheStore.cacheStatus);
        }

        msgInfo = {
          ...msgInfo,
          time: response_now.toISOString(),
          latency: calcLatency(request_now, response_now),
          status: response.statusCode,
          type: 'response',
          cache_status: cacheStore.cacheStatus,
        };
        this.logger.log(msgInfo);
      }),
      map(data => ({
        code: HttpStatus.OK,
        message: '',
        data,
      })),
      catchError(err => {
        const isAxiosError = err instanceof AxiosError;
        let message = 'Internal Server Error';
        let code = HttpStatus.INTERNAL_SERVER_ERROR;
        if (isAxiosError) {
          const axiosError = err as AxiosError<string>;
          const { response } = axiosError;
          if (response) {
            if (typeof response === 'object') {
              ({ data: message, status: code } = response);
            } else {
              message = response;
            }
          } else {
            message = axiosError.message ?? err;
            code = axiosError.status ?? code;
          }
        } else {
          const { response } = err;
          if (response) {
            if (typeof response === 'object') {
              ({ message, statusCode: code } = response);
            } else {
              message = response;
            }
          } else {
            message = err.message ?? err;
            code = err.status ?? code;
          }
        }

        const response_now = new Date();
        const response_body = {
          code,
          message,
        };

        msgInfo = {
          ...msgInfo,
          time: response_now.toISOString(),
          latency: calcLatency(request_now, response_now),
          status: code,
          response_body: JSON.stringify(response_body),
          type: 'response',
        };
        this.logger.error(msgInfo);

        if (code === 400) {
          return throwError(
            () =>
              new BadRequestException(
                message || 'Bad request',
              ),
          );
        }

        if (code === 401) {
          return throwError(
            () =>
              new UnauthorizedException(
                message || 'Unauthorized',
              ),
          );
        }

        if (code === 404) {
          return throwError(
            () =>
              new NotFoundException(message || 'Not found'),
          );
        }

        return throwError(
          () =>
            new HttpException(
              message || 'Unexpected error',
              code || 500,
            ),
        );
      }),
        ).subscribe(observer);
      });
    });
  }
}
