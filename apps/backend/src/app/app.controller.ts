import {
  Controller,
  Get,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Observable, Subject, map } from 'rxjs';

import { Public } from '../features/auth/auth.decorator';
import { QueryDto } from '../features/query.dto';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  private messageQueue: Subject<string> = new Subject();

  constructor(private readonly service: AppService) {}

  @Get('/job-count')
  @ApiOperation({
    summary: 'Get the total job count statistics',
    description:
      'Returns aggregated counts of all jobs in the system. The result is cached. This endpoint is public (no authentication required).',
  })
  getJobCount() {
    return this.service.getJobCount();
  }

  @Get('/job-host-statistics')
  @ApiOperation({
    summary: 'Get the job share per source host',
    description:
      'Returns the number of jobs and their percentage share grouped by source host (extracted from each job detail_link), e.g. www.104.com.tw and www.cake.me. Backed by the get_job_host_statistics database function. The result is cached. This endpoint is public (no authentication required).',
  })
  getJobHostStatistics() {
    return this.service.getJobHostStatistics();
  }

  @Get('/salary/type/median/ratio')
  @ApiOperation({
    summary:
      'Get the median salary ratio distribution by salary type',
    description:
      'Returns the materialized-view result of median salary ratios aggregated by salary type (e.g. monthly, yearly, hourly). Cached. This endpoint is public (no authentication required).',
  })
  getMvSalaryTypeMedianRatio() {
    return this.service.getMvSalaryTypeMedianRatio();
  }

  @Get('/salary/range/multiplier')
  @ApiOperation({
    summary:
      'Get the salary range multiplier distribution',
    description:
      'Returns the materialized-view result of salary range multipliers (avg max/min salary) per salary type. Cached. This endpoint is public (no authentication required).',
  })
  getMvSalaryRangeMultiplier() {
    return this.service.getMvSalaryRangeMultiplier();
  }

  @Get('/keyword/group/ranking')
  @ApiOperation({
    summary: 'Query the keyword-group ranking',
    description:
      'Returns the ranking of keyword groups. When from=0 and to=15 (the home-page case) the result is cached, and passing where={"category":{"eq":"language"}} filters by category with a separate cache entry per category. Example: /keyword/group/ranking?from=0&to=15&where={"category":{"eq":"language"}}',
  })
  async getTechRanking(@Query() query: QueryDto) {
    return this.service.getMvTechRanking(query);
  }

  @Get('/keyword/group/tech-combo-stats')
  @ApiOperation({
    summary: 'Query technology combination statistics',
    description:
      'Reads from the mv_tech_combo_stats materialized view. Each row is a technology pair (tech1 paired with tech2) with its co-occurrence job_count and salary benchmarks (median/PR75/PR88, both monthly and yearly). Not cached. Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. Example: /keyword/group/combo?from=0&to=20&orders=job_count:desc filters/sorts the top 20 pairs by job count.',
  })
  async getTechTechComboStats(
    @Query() query: QueryDto,
  ) {
    return this.service.getMvTechComboStatsService(query);
  }

  @Get('/methodology/sql')
  @ApiOperation({
    summary: 'Get the source SQL behind each analytical metric',
    description:
      'Returns a map of database object name to its CREATE statement (view / materialized view / function), extracted from supabase/schema.sql at build time. Used by the methodology page to show the SQL behind each number. Public (no authentication required).',
  })
  getMethodologySql() {
    return this.service.getMethodologySql();
  }

  @Sse('/sse')
  sse(): Observable<MessageEvent> {
    return this.messageQueue.pipe(
      map(data => ({ data }) as MessageEvent),
    );
  }
}
