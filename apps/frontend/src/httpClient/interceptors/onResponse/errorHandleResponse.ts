import {
  AxiosError,
  AxiosResponse,
  HttpStatusCode,
  InternalAxiosRequestConfig,
} from 'axios';

const errorHandlerMap: Record<
  number | HttpStatusCode,
  ({
    config,
    response,
  }: {
    config: InternalAxiosRequestConfig;
    response: AxiosResponse;
  }) => void
> = {
  [HttpStatusCode.Unauthorized]() {
    console.error('Unauthorized');
  },
  [HttpStatusCode.NotFound]() {
    const title = 'Page Not Found';
    const content =
      'The page you requested could not be found. Please check the URL and try again. If you believe this is an error, please contact the system administrator.';
    console.error({
      title,
      content,
    });
  },
  [HttpStatusCode.Forbidden]() {
    const title = 'Permission denied';
    const content =
      'You do not have permission to access this page, please refer to your system administrator.';
    console.error({
      title,
      content,
    });
  },
  [HttpStatusCode.InternalServerError]() {
    const title = 'Internal Server Error';
    const content =
      'An unexpected error has occurred on the server. Please try again later. If the problem persists, please contact the system administrator.';
    console.error({
      title,
      content,
    });
  },
  [HttpStatusCode.BadRequest]() {
    const title = 'Bad Request';
    const content =
      'The server could not understand the request due to invalid syntax. Please check your request and try again. If the problem persists, please contact the system administrator.';
    console.error({
      title,
      content,
    });
  },
};

export default (error: Error) => {
  const isAxiosError = error instanceof AxiosError;
  const { config, response } = error as AxiosError;

  if (isAxiosError && config && response) {
    const handler =
      errorHandlerMap[response.status as HttpStatusCode];
    if (typeof handler === 'function') {
      handler({ config, response });
    }
  } else {
    console.error(error);
  }

  return Promise.reject(error);
};
