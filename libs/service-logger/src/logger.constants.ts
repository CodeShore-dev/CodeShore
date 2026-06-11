import type { DestinationStream } from 'pino';

export const PINO_LOGGER = Symbol('PLATFORM_PINO_LOGGER');

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LoggerModuleOptions {
  level?: LogLevel;
  destination?: DestinationStream;
  pretty?: boolean;
}
