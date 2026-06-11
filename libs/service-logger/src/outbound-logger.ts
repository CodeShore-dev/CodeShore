import { AxiosError } from 'axios';

import { ServiceLogger } from '@codeshore/service-logger';

import {
  calcLatency,
  stringifyBody,
  stringifyObject,
} from './log-format.util';

export type LoggerRequest = {
  headers?: Record<string, string>;
  caller?: string;
  method?: string;
  name?: string;
  host?: string;
  path?: string;
  url?: string;
  query?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
};

export type LogResponseFn = (
  response: LoggerResponse,
) => void;

export type LogExceptionFn<T = Error> = (
  error: T,
  isExpected?: boolean,
  fromErrorToResponse?: (error: T) => {
    status?: number;
    data: unknown;
  },
) => void;

export type LoggerResponse = {
  status: number;
  data: unknown;
};

export class OutboundLogger {
  constructor(private logger: ServiceLogger) {}

  public logRequest<T>(request: LoggerRequest): {
    logResponse: LogResponseFn;
    logException: LogExceptionFn<T>;
  } {
    const requestStartedAt = new Date();

    let urlObject;
    if (request.url) {
      urlObject = new URL(request.url);
    }

    let host = request.host;
    if (!host && urlObject) {
      host = urlObject.host;
    }

    let path = request.path;
    if (!path && urlObject) {
      path = urlObject.pathname;
    }

    let request_query = stringifyObject(request.query);
    if (request_query && urlObject) {
      request_query = stringifyObject(
        Object.fromEntries(urlObject.searchParams),
      );
    }
    const msg = {
      name: request.name?.replace(/^_/, '') || undefined,
      caller: request.caller,
      method: request.method ?? 'GET',
      host,
      path,
      request_query,
      request_params: stringifyObject(request.params),
      request_body: stringifyBody(request.body),
      status: undefined,
      response_body: undefined,
      latency_s: undefined,
      time: requestStartedAt.toISOString(),
      direction: 'outbound',
      type: 'request',
    };

    const logBase = (
      level: 'info' | 'trace' | 'debug' | 'error' | 'warn',
      response: { status?: number; data: unknown },
    ) => {
      const respondedAt = new Date();
      const _msg = {
        ...msg,
        type: 'response',
        time: respondedAt.toISOString(),
        latency_s: calcLatency(
          requestStartedAt,
          respondedAt,
        ),
        status: response.status,
        response_body: stringifyBody(response.data),
      };

      if (level === 'error') {
        this.logger.error(undefined, undefined, _msg);
      } else {
        this.logger[level](undefined, _msg);
      }
    };

    this.logger.debug(undefined, msg);

    return {
      logResponse(response: LoggerResponse) {
        logBase('debug', response);
      },
      logException<T>(
        error: T,
        isExpected: boolean = false,
        fromErrorToResponse?: (error: T) => {
          status?: number;
          data: unknown;
        },
      ) {
        const axiosError = error as AxiosError;
        const response = fromErrorToResponse
          ? fromErrorToResponse(error)
          : {
              status: axiosError.response?.status,
              data: axiosError.response?.data ?? error,
            };
        logBase(isExpected ? 'warn' : 'error', response);
      },
    };
  }
}
