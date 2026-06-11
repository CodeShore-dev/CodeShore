import {
  Controller as ControllerDecorator,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminOnly } from '../auth/auth.decorator';
import { QueryDto } from '../query.dto';
import { Service } from './service';

const name = 'keyword';

@ApiBearerAuth()
@ApiTags(name)
@ControllerDecorator(name)
export class Controller {
  constructor(private readonly service: Service) {}

  @Get('group')
  @ApiOperation({
    summary: 'Query keyword groups (supports pagination, sorting and filtering)',
    description:
      'Reads from the keyword-group materialized view. When from=0 and to=-1 (fetch all), the result is served from the server-side cache. Example: /keyword/group?from=0&to=-1 returns the full grouping; /keyword/group?from=0&to=20&orders=count:desc returns the top 20.',
  })
  async getMvKeywordGroup(@Query() query: QueryDto) {
    return this.service.getMvKeywordGroup(query);
  }

  @Get('group/category')
  @ApiOperation({
    summary: 'List keyword-group categories',
    description:
      'Returns the aggregated categories of keyword groups. Cached. Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. Example: /keyword/group/category?orders=count:desc',
  })
  async getKeywordGroupCategories(
    @Query() query: QueryDto,
  ) {
    return this.service.getKeywordGroupCategories(query);
  }

  @Get('group/ranking')
  @ApiOperation({
    summary: 'Query the keyword-group ranking',
    description:
      'Returns the ranking of keyword groups. When from=0 and to=15 (the home-page case) the result is cached, and passing where={"category":{"eq":"language"}} filters by category with a separate cache entry per category. Example: /keyword/group/ranking?from=0&to=15&where={"category":{"eq":"language"}}',
  })
  async getKeywordGroupRanking(
    @Query() query: QueryDto,
  ) {
    return this.service.getMvKeywordGroupRanking(query);
  }

  @Get('group/tech-combo-stats')
  @ApiOperation({
    summary: 'Query technology combination statistics',
    description:
      'Reads from the mv_tech_combo_stats materialized view. Each row is a technology pair (tech1 paired with tech2) with its co-occurrence job_count and salary benchmarks (median/PR75/PR88, both monthly and yearly). Not cached. Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. Example: /keyword/group/combo?from=0&to=20&orders=job_count:desc filters/sorts the top 20 pairs by job count.',
  })
  async getKeywordGroupTechComboStats(
    @Query() query: QueryDto,
  ) {
    return this.service.getMvTechComboStatsService(query);
  }

  @Post('group/reset')
  @ApiOperation({
    summary: 'Rebuild keyword-related tables (admin only)',
    description:
      'Recomputes and rebuilds the relations between job_keywords, keywords and job_keyword_group. This is an expensive maintenance operation, restricted to admin users, and takes no parameters.',
  })
  @AdminOnly()
  resetJobKeywords_Keywords_JobKeywordGroup() {
    return this.service.resetJobKeywords_Keywords_JobKeywordGroup();
  }
}
