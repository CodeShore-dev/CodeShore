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
import { AxiosError } from 'axios';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import {
  CacheRequestStore,
  cacheALS,
} from '@codeshore/service-cache';
import { ServiceLogger } from '@codeshore/service-logger';
import {
  calcLatency,
  stringifyBody,
  stringifyObject,
} from '@codeshore/service-logger';

type NormalizedError = { message: string; code: number };

const EXCEPTION_BY_STATUS: Record<
  number,
  (message: string) => HttpException
> = {
  400: message =>
    new BadRequestException(message || 'Bad request'),
  401: message =>
    new UnauthorizedException(message || 'Unauthorized'),
  404: message =>
    new NotFoundException(message || 'Not found'),
};

function normalizeError(err: unknown): NormalizedError {
  let message = 'Internal Server Error';
  let code = HttpStatus.INTERNAL_SERVER_ERROR;

  if (err instanceof AxiosError) {
    const { response } = err as AxiosError<string>;
    if (response) {
      if (typeof response === 'object') {
        ({ data: message, status: code } = response);
      } else {
        message = response;
      }
    } else {
      message = err.message ?? String(err);
      code = err.status ?? code;
    }
    return { message, code };
  }

  const { response } = err as {
    response?:
      | { message: string; statusCode: number }
      | string;
    message?: string;
    status?: number;
  };
  if (response) {
    if (typeof response === 'object') {
      ({ message, statusCode: code } = response);
    } else {
      message = response;
    }
  } else {
    const fallback = err as {
      message?: string;
      status?: number;
    };
    message = fallback.message ?? String(err);
    code = fallback.status ?? code;
  }
  return { message, code };
}

function toHttpException(
  code: number,
  message: string,
): HttpException {
  const factory = EXCEPTION_BY_STATUS[code];
  return factory
    ? factory(message)
    : new HttpException(
        message || 'Unexpected error',
        code || 500,
      );
}

@Injectable()
export class InboundInterceptor implements NestInterceptor {
  constructor(private readonly logger: ServiceLogger) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const requestStartedAt = new Date();

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const userAgent = request.headers?.['user-agent'];
    const traceId = request.headers?.['trace-id'];

    let urlObject;
    if (request.url) {
      urlObject = new URL(`http://localhost${request.url}`);
    }
    let path = request.path;
    if (!path && urlObject) {
      path = urlObject.pathname;
    }

    let msg = {
      trace_id: traceId,
      method: request.method,
      path,
      request_query:
        stringifyObject(request.query) ??
        (urlObject?.searchParams.toString() || undefined),
      request_params: stringifyObject(request.params),
      request_body: stringifyBody(request.body),
      status: undefined as number | undefined,
      response_body: undefined as string | undefined,
      latency_s: undefined as number | undefined,
      ip: request.ip,
      'user-agent': userAgent,
      time: requestStartedAt.toISOString(),
      direction: 'inbound',
      type: 'request',
      cache_status:
        undefined as CacheRequestStore['cacheStatus'],
    };

    const cacheStore: CacheRequestStore = {};

    this.logger.info(undefined, msg);

    return new Observable(observer => {
      cacheALS.run(cacheStore, () => {
        next
          .handle()
          .pipe(
            tap(() => {
              const respondedAt = new Date();

              if (cacheStore.cacheStatus) {
                response.setHeader(
                  'X-Cache',
                  cacheStore.cacheStatus,
                );
              }

              msg = {
                ...msg,
                time: respondedAt.toISOString(),
                latency_s: calcLatency(
                  requestStartedAt,
                  respondedAt,
                ),
                status: response.statusCode,
                type: 'response',
                cache_status: cacheStore.cacheStatus,
              };
              this.logger[
                cacheStore.cacheStatus === 'HIT'
                  ? 'trace'
                  : 'info'
              ](undefined, msg);
            }),
            map(data => ({
              code: HttpStatus.OK,
              message: undefined,
              data,
            })),
            catchError(err => {
              const { message, code } = normalizeError(err);

              const respondedAt = new Date();
              const responseBody = { code, message };

              msg = {
                ...msg,
                time: respondedAt.toISOString(),
                latency_s: calcLatency(
                  requestStartedAt,
                  respondedAt,
                ),
                status: code,
                response_body: JSON.stringify(responseBody),
                type: 'response',
              };
              this.logger.error(undefined, undefined, msg);

              return throwError(() =>
                toHttpException(code, message),
              );
            }),
          )
          .subscribe(observer);
      });
    });
  }
}

