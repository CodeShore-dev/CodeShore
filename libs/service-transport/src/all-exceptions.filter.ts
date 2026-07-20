import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ServiceCode, ServiceException } from '@codeshore/codebook';
import { ServiceLogger } from '@codeshore/service-logger';
import type { ServiceResponse } from './@types';

interface HttpRequestLike {
  method?: string;
  url?: string;
  path?: string;
}

interface HttpResponseLike {
  status(code: number): this;
  json(body: ServiceResponse<unknown>): unknown;
}

const UNEXPECTED_MESSAGE = 'Internal server error';

/**
 * The last-resort boundary for every exception, including ones thrown by
 * Guards -- those never reach InboundInterceptor (guards run before
 * interceptors), so this filter is the only place guaranteed to see them.
 * Logging here, in addition to InboundInterceptor's own access-log entry for
 * exceptions that do reach it, is what makes 401/403/400 guard rejections
 * (auth failures, permission denials, query-limit violations) show up in the
 * logs at all.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: ServiceLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<HttpRequestLike>();
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const { status, body } = this.resolve(exception);

    this.logger.error(undefined, exception, {
      method: request?.method,
      path: request?.path ?? request?.url,
      status,
      response_body: JSON.stringify(body),
      type: 'response',
    });

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    body: ServiceResponse<unknown>;
  } {
    if (exception instanceof ServiceException) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { code: exception.code, message: exception.message },
      };
    }

    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        body: {
          code: ServiceCode.DefaultFailed,
          message: this.httpExceptionMessage(exception),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ServiceCode.DefaultFailed, message: UNEXPECTED_MESSAGE },
    };
  }

  private httpExceptionMessage(exception: HttpException): string {
    const res = exception.getResponse();
    if (typeof res === 'string') {
      return res;
    }
    if (typeof res === 'object' && res !== null) {
      const { message } = res as { message?: unknown };
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.filter((m): m is string => typeof m === 'string').join(', ');
      }
    }
    return exception.message;
  }
}
