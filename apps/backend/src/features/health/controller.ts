import { Controller as ControllerDecorator, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '../auth/auth.decorator';

// 150MB is comfortably above this service's normal footprint (see
// features/cache/controller.ts's `memory` endpoint for the actual numbers
// observed in practice) -- this just catches a real leak, not a tight budget.
const HEAP_THRESHOLD_BYTES = 150 * 1024 * 1024;

@ApiTags('health')
@ControllerDecorator('health')
export class Controller {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(MemoryHealthIndicator) private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness check for Cloud Run / Lambda (heap usage only, no DB call)',
  })
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', HEAP_THRESHOLD_BYTES),
    ]);
  }
}
