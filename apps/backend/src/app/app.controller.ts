import {
  Controller,
  Get,
  Sse,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Observable, Subject, map } from 'rxjs';

import { Public } from '../features/auth/auth.decorator';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  private messageQueue: Subject<string> = new Subject();

  constructor(private readonly appService: AppService) {}

  @Get('/job-count')
  @ApiOperation({
    summary: 'Get the total job count statistics',
    description:
      'Returns aggregated counts of all jobs in the system. The result is cached. This endpoint is public (no authentication required).',
  })
  getJobCount() {
    return this.appService.getJobCount();
  }

  @Get('/salary/type/median/ratio')
  @ApiOperation({
    summary: 'Get the median salary ratio distribution by salary type',
    description:
      'Returns the materialized-view result of median salary ratios aggregated by salary type (e.g. monthly, yearly, hourly). Cached. This endpoint is public (no authentication required).',
  })
  getMvSalaryTypeMedianRatio() {
    return this.appService.getMvSalaryTypeMedianRatio();
  }

  @Get('/salary/weighted/ratio')
  @ApiOperation({
    summary: 'Get the sample-weighted salary ratio distribution',
    description:
      'Returns the materialized-view result of salary ratios weighted by sample size. Cached. This endpoint is public (no authentication required).',
  })
  getMvSalaryWeightedRatio() {
    return this.appService.getMvSalaryWeightedRatio();
  }

  @Sse('/sse')
  sse(): Observable<MessageEvent> {
    return this.messageQueue.pipe(
      map(data => ({ data }) as MessageEvent),
    );
  }
}
