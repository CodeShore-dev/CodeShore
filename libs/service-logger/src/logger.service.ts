import { Inject, Injectable } from '@nestjs/common';
import type { Logger as PinoLogger } from 'pino';

import { PINO_LOGGER } from './logger.constants';
import { TraceContextStore } from './trace-context.store';

@Injectable()
export class ServiceLogger {
  constructor(
    @Inject(PINO_LOGGER) private readonly logger: PinoLogger,
    @Inject(TraceContextStore) private readonly store: TraceContextStore,
  ) {}

  trace(message?: string, fields?: Record<string, unknown>): void {
    this.logger.trace(this.merge(fields), message);
  }
  
  debug(message?: string, fields?: Record<string, unknown>): void {
    this.logger.debug(this.merge(fields), message);
  }

  info(message?: string, fields?: Record<string, unknown>): void {
    this.logger.info(this.merge(fields), message);
  }

  warn(message?: string, fields?: Record<string, unknown>): void {
    this.logger.warn(this.merge(fields), message);
  }

  error(
    message?: string,
    error?: unknown,
    fields?: Record<string, unknown>,
  ): void {
    this.logger.error(this.merge({ ...fields, ...serializeError(error) }), message);
  }

  private merge(fields?: Record<string, unknown>): Record<string, unknown> {
    const context = this.store.current();
    return { ...fields, ...context };
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error === undefined) {
    return {};
  }
  if (error instanceof Error) {
    return { err: { name: error.name, message: error.message, stack: error.stack } };
  }
  return { err: error };
}
