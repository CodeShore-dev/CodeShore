import {
  type DynamicModule,
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { type Logger, pino } from 'pino';

import { ServiceLogger } from './logger.service';
import {
  type LoggerModuleOptions,
  PINO_LOGGER,
} from './logger.constants';
import { TraceContextMiddleware } from './trace-context.middleware';
import { TraceContextStore } from './trace-context.store';

@Global()
@Module({})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceContextMiddleware).forRoutes('{*path}');
  }
  static forRoot(
    options: LoggerModuleOptions = {},
  ): DynamicModule {
    const level = options.level ?? 'trace';
    const pretty = options.pretty ?? process.env['NODE_ENV'] !== 'production';

    let logger: Logger;
    if (options.destination) {
      logger = pino({ level }, options.destination);
    } else if (pretty) {
      logger = pino({
        level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      });
    } else {
      logger = pino({ level });
    }

    return {
      module: LoggerModule,
      providers: [
        TraceContextStore,
        TraceContextMiddleware,
        { provide: PINO_LOGGER, useValue: logger },
        ServiceLogger,
      ],
      exports: [
        TraceContextStore,
        TraceContextMiddleware,
        ServiceLogger,
        PINO_LOGGER,
      ],
    };
  }
}
