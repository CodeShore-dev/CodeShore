import {
  Body,
  Controller as ControllerDecorator,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminOnly } from '../auth/auth.decorator';
import { QueryDto } from '../query.dto';
import { UpdateIconSlugsDto } from './dto';
import { Service } from './service';

const name = 'keyword';

@ApiBearerAuth()
@ApiTags(name)
@ControllerDecorator(name)
export class Controller {
  constructor(private readonly service: Service) {}

  @Get('group')
  @ApiOperation({
    summary:
      'Query keyword groups (supports pagination, sorting and filtering)',
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

  @Patch('group/icon-slugs')
  @ApiOperation({
    summary:
      'Update the ordered icon sources of a keyword group (admin only)',
    description:
      "Replaces keyword_group.icon_slugs with the given ordered list ('source:slug', earlier = higher priority) and refreshes the keyword-group materialized view. The id is in the body so keyword ids containing slashes are handled.",
  })
  @AdminOnly()
  updateKeywordGroupIconSlugs(
    @Body() dto: UpdateIconSlugsDto,
  ) {
    return this.service.updateKeywordGroupIconSlugs(
      dto.id,
      dto.icon_slugs,
    );
  }
}
