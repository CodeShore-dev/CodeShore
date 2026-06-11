import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';

import { TraceContextStore } from './trace-context.store';

type NextFunction = () => void;

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(TraceContextStore) private readonly store: TraceContextStore,
  ) {}

  use(_req: unknown, _res: unknown, next: NextFunction): void {
    this.store.run({ traceId: crypto.randomUUID() }, () => {
      next();
    });
  }
}
