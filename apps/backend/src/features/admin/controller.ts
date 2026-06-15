import {
  Body,
  Controller as ControllerDecorator,
  Get,
  Param,
  Patch,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { AdminOnly } from '../auth/auth.decorator';
import {
  CrawlDto,
  LocationAnomalyDto,
  SalaryAnomalyDto,
  StatsDto,
  UpdateSalaryDto,
} from './dto';
import { Service } from './service';

const name = 'admin/job';

@ApiBearerAuth()
@ApiTags(name)
@AdminOnly()
@ControllerDecorator(name)
export class Controller {
  constructor(private readonly service: Service) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Job crawl stats: new-job and recently-updated counts within the last N days (default 7)',
  })
  getStats(@Query() query: StatsDto) {
    return this.service.getStats(query.days);
  }

  @Get('update-date-counts')
  @ApiOperation({
    summary:
      'Jobs grouped by updated_at date (newest first), for the daily update table',
  })
  getUpdateDateCounts() {
    return this.service.getUpdateDateCounts();
  }

  @Get('anomaly/salary')
  @ApiOperation({
    summary:
      'Jobs whose parsed salary is implausibly high for its salary_type',
  })
  getSalaryAnomalies(@Query() query: SalaryAnomalyDto) {
    return this.service.getSalaryAnomalies(
      query,
      query.monthCeil,
      query.yearCeil,
    );
  }

  @Patch(':id/salary')
  @ApiOperation({
    summary:
      'Manually set a job min/max salary and mark it salary_manual (crawler will not overwrite)',
  })
  updateSalary(
    @Param('id') id: string,
    @Body() body: UpdateSalaryDto,
  ) {
    return this.service.updateSalary(
      id,
      body.min_salary,
      body.max_salary,
      body.salary_type,
    );
  }

  @Get('anomaly/empty-description')
  @ApiOperation({ summary: 'Jobs with an empty description' })
  getEmptyDescriptionJobs(@Query() query: SalaryAnomalyDto) {
    return this.service.getEmptyDescriptionJobs(query);
  }

  @Get('anomaly/location')
  @ApiOperation({
    summary:
      'Jobs with an anomalous location (blank / unmapped / malformed)',
  })
  getLocationAnomalies(@Query() query: LocationAnomalyDto) {
    return this.service.getLocationAnomalies(
      query.type,
      query.maxLen,
      query,
    );
  }

  @Sse('crawl')
  @ApiOperation({
    summary:
      'Start the crawler (structured, admin-only) and stream progress via SSE',
  })
  crawl(@Query() query: CrawlDto): Observable<MessageEvent> {
    return this.service.spawnCrawl(query);
  }
}
