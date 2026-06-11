import { Provider } from '@nestjs/common';

import { ServiceLogger } from '@codeshore/service-logger';

type LoggerServiceClass<T> = new (logger?: ServiceLogger) => T;

export function provideWithLogger<T>(service: LoggerServiceClass<T>): Provider {
  return {
    provide: service,
    useFactory: (logger?: ServiceLogger) => new service(logger),
    inject: [ServiceLogger],
  };
}
