import { AxiosInstance, AxiosResponse } from 'axios';

import { OutboundLogger } from '@codeshore/service-logger';

export class RequestWrapper {
  constructor(
    private _outboundLogger: OutboundLogger,
    private _axios: AxiosInstance,
  ) {}

  async call<Query, Response>(
    url: string,
    query: Query,
    options?: {
      method?: 'get' | 'post' | 'delete' | 'put' | 'patch';
      name?: string;
    },
  ) {
    const name = options?.name ?? 'unknown';
    const method = options?.method ?? 'get';

    const { logResponse, logException } =
      this._outboundLogger.logRequest({
        name,
        method,
        url,
        query: query as Record<string, string>,
      });
    try {
      const response = await this._axios[method]<Response>(
        url,
        {
          params: query,
        },
      );
      logResponse(response);
      return response.data;
    } catch (error) {
      logException(error as Error);
      throw error;
    }
  }

  public async continueCall<Query, Response, Result = any>(
    url: string,
    query: Query,
    continuePredicate: (response: Response) => boolean,
    collectData: (response: Response) => Result[],
    options?: {
      method?: 'get' | 'post' | 'delete' | 'put' | 'patch';
      name?: string;
    },
  ) {
    let _continue = true;
    let result: Result[] = [];
    do {
      const data = await this.call<Query, Response>(
        url,
        query,
        options,
      );
      result.push(...(collectData(data) ?? []));
      _continue = continuePredicate(data);
    } while (_continue);
    return result;
  }
}
