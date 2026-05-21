import { AxiosError } from 'axios';

import { ServiceLogger } from './service-logger';

export type LoggerRequest = {
  headers?: Record<string, string>;
  caller?: string;
  method?: string;
  name: string;
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
export type LogExceptionFn = (
  error: Error,
  isExpected?: boolean,
) => void;

export type LoggerResponse = {
  status: number;
  data: unknown;
};

export class OutboundLogger {
  constructor(private logger: ServiceLogger) {}

  public logRequest(request: LoggerRequest): {
    logResponse: LogResponseFn;
    logException: LogExceptionFn;
  } {
    const request_now = new Date();

    const calcLatency = (start: Date, end: Date) => {
      const latency_sec =
        (end.getTime() - start.getTime()) / 1000;
      return latency_sec;
    };

    const stringifyObject = (value: unknown) => {
      try {
        return value && Object.keys(value).length > 0
          ? JSON.stringify(value)
          : undefined;
      } catch {
        return undefined;
      }
    };

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
      path = host
        ? urlObject.href.replace(
            new RegExp(`https?://${host}`),
            '',
          )
        : urlObject.pathname;
    }
    const msgInfo = {
      name: request.name.replace(/^_/, ''),
      caller: request.caller,
      method: request.method ?? 'GET',
      host,
      path,
      request_query: stringifyObject(request.query),
      request_params: stringifyObject(request.params),
      request_body: Buffer.isBuffer(request.body)
        ? `a ${request.body.length} bytes binary`
        : stringifyObject(request.body),
      status: undefined,
      response_body: undefined,
      latency: undefined,
      time: request_now.toISOString(),
      direction: 'outbound',
      type: 'request',
    };

    this.logger.log(msgInfo);

    const logBase = (
      level: 'log' | 'error' | 'warn',
      response: { status?: number; data: unknown },
    ) => {
      const response_now = new Date();

      this.logger[level]({
        ...msgInfo,
        type: 'response',
        time: response_now.toISOString(),
        latency: calcLatency(request_now, response_now),
        status: response.status,
        response_body: Buffer.isBuffer(response.data)
          ? `a ${response.data.length} bytes binary`
          : stringifyObject(response.data),
      });
    };

    return {
      logResponse(response: LoggerResponse) {
        logBase('log', response);
      },
      logException(
        error: Error,
        isExpected: boolean = false,
      ) {
        const axiosError = error as AxiosError;
        const response = {
          status: axiosError.response?.status,
          data:
            axiosError.response?.data ?? error.toString(),
        };
        logBase(isExpected ? 'warn' : 'error', response);
      },
    };
  }
}
