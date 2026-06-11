import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

export interface LogContext {
  traceId: string;
  [key: string]: string | undefined;
}

@Injectable()
export class TraceContextStore {
  private readonly als = new AsyncLocalStorage<LogContext>();

  run<T>(seed: LogContext, fn: () => T): T {
    return this.als.run({ ...seed }, fn);
  }

  enrich(fields: Partial<LogContext>): void {
    const store = this.als.getStore();
    if (store === undefined) {
      return;
    }
    Object.assign(store, fields);
  }

  current(): Readonly<LogContext> | undefined {
    return this.als.getStore();
  }
}
