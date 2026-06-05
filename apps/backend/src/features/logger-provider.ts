import { Provider } from '@nestjs/common';

import { ServiceLogger } from '@codeshore/service-logger';

type LoggerServiceClass<T> = new (logger?: ServiceLogger) => T;

/**
 * 建立一個由 ServiceLogger 注入的 provider，
 * 避免每個服務都重複寫相同的 useFactory / inject。
 */
export function provideWithLogger<T>(service: LoggerServiceClass<T>): Provider {
  return {
    provide: service,
    useFactory: (logger?: ServiceLogger) => new service(logger),
    inject: [ServiceLogger],
  };
}
