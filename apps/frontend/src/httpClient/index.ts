import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import { baseURL } from './constants';

export let httpClient: AxiosInstance;

export const createHttpClient = (
  lifecycle?: { beforeCreate: () => void },
  interceptors?: {
    request?: {
      usesOnFullFilled?: ((
        config: InternalAxiosRequestConfig,
      ) =>
        | InternalAxiosRequestConfig
        | Promise<InternalAxiosRequestConfig>)[];
      usesOnRejected?: ((
        error: AxiosError,
      ) => AxiosError | Promise<AxiosError>)[];
    };
    response?: {
      usesOnFullFilled?: ((
        response: AxiosResponse,
      ) => AxiosResponse | Promise<AxiosResponse>)[];
      usesOnRejected?: ((
        error: AxiosError,
      ) => AxiosError | Promise<AxiosError>)[];
    };
  },
) => {
  if (typeof lifecycle?.beforeCreate === 'function') {
    lifecycle.beforeCreate();
  }

  httpClient = axios.create({
    baseURL,
  });

  httpClient.interceptors.request.use(
    config =>
      operateOneByOne(
        interceptors?.request?.usesOnFullFilled,
        config,
      ),
    error =>
      operateOneByOne(
        interceptors?.request?.usesOnRejected,
        error,
      ),
  );
  httpClient.interceptors.response.use(
    response =>
      operateOneByOne(
        interceptors?.response?.usesOnFullFilled,
        response,
      ),
    error =>
      ['ERR_CANCELED'].includes(error.code)
        ? error
        : operateOneByOne(
            interceptors?.response?.usesOnRejected,
            error,
          ),
  );
};

const operateOneByOne = <T>(
  source: ((
    value: T,
  ) => Awaited<T> | Promise<Awaited<T>>)[] = [],
  defaultValue: T,
) =>
  source.reduce(
    (prev, curr) => prev.then(v => curr(v)),
    Promise.resolve(defaultValue),
  );
