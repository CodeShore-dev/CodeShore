import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ServiceCode, ServiceException } from '@codeshore/codebook';
import type { ServiceResponse } from './@types';

interface HttpResponseLike {
  status(code: number): this;
  json(body: ServiceResponse<unknown>): unknown;
}

const UNEXPECTED_MESSAGE = 'Internal server error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const { status, body } = this.resolve(exception);
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
