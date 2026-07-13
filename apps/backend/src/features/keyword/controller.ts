import {
  Body,
  Controller as ControllerDecorator,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminOnly, Public } from '../auth/auth.decorator';
import { QueryDto } from '../query.dto';
import {
  CreateTechDto,
  JobDescriptionWhereDto,
  UpdateIconSlugsDto,
  UpdateTechDto,
} from './dto';
import { Service } from './service';

const name = 'keyword';

@ApiBearerAuth()
@ApiTags(name)
@ControllerDecorator(name)
export class Controller {
  constructor(private readonly service: Service) {}

  @Get('group')
  @Public()
  @ApiOperation({
    summary:
      'Query keyword groups (supports pagination, sorting and filtering)',
    description:
      'Reads from the keyword-group materialized view. Public: does not depend on the caller. When from=0 and to=-1 (fetch all), the result is served from the server-side cache. Example: /keyword/group?from=0&to=-1 returns the full grouping; /keyword/group?from=0&to=20&orders=count:desc returns the top 20.',
  })
  async getMvTech(@Query() query: QueryDto) {
    return this.service.getMvTech(query);
  }

  @Get('group/category')
  @Public()
  @ApiOperation({
    summary: 'List keyword-group categories',
    description:
      'Returns the aggregated categories of keyword groups. Public: does not depend on the caller. Cached. Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. Example: /keyword/group/category?orders=count:desc',
  })
  async getTechCategories(
    @Query() query: QueryDto,
  ) {
    return this.service.getTechCategories(query);
  }

  @Post('group/reset')
  @ApiOperation({
    summary: 'Rebuild keyword-related tables (admin only)',
    description:
      'Recomputes and rebuilds the relations between job_keywords, keywords and job_tech. This is an expensive maintenance operation, restricted to admin users, and takes no parameters.',
  })
  @AdminOnly()
  resetJobKeywords_Keywords_JobTech() {
    return this.service.resetJobKeywords_Keywords_JobTech();
  }

  @Post('group/lines/reset')
  @ApiOperation({
    summary:
      'Rebuild job_description_line only, for jobs matching an optional filter (admin only)',
    description:
      "Splits job.description into per-line job_description_line rows (job.description -> job_description_line stage only). Independent of the combined 'group/reset' route above -- does not touch job_description_line_keyword or job_keyword, and is not called by 'group/reset'. Scoped to the optional `where` filter on `job`; omit it to process every job.",
  })
  @AdminOnly()
  resetJobDescriptionLines(@Body() dto: JobDescriptionWhereDto) {
    return this.service.resetJobDescriptionLines(dto.where);
  }

  @Post('group/line-keywords/reset')
  @ApiOperation({
    summary:
      'Rebuild job_description_line_keyword only, for jobs matching an optional filter (admin only)',
    description:
      "Rule-extracts and AI-reviews the keywords for each existing job_description_line row (job_description_line -> job_description_line_keyword stage only; run 'group/lines/reset' first if the lines do not exist yet). Independent of the combined 'group/reset' route above -- does not touch job_keyword. Scoped to the optional `where` filter on `job`; omit it to process every job's existing lines.",
  })
  @AdminOnly()
  resetJobDescriptionLineKeywords(
    @Body() dto: JobDescriptionWhereDto,
  ) {
    return this.service.resetJobDescriptionLineKeywords(dto.where);
  }

  @Patch('group/icon-slugs')
  @ApiOperation({
    summary:
      'Update the ordered icon sources of a keyword group (admin only)',
    description:
      "Replaces tech.icon_slugs with the given ordered list ('source:slug', earlier = higher priority) and refreshes the keyword-group materialized view. The id is in the body so keyword ids containing slashes are handled.",
  })
  @AdminOnly()
  updateTechIconSlugs(
    @Body() dto: UpdateIconSlugsDto,
  ) {
    return this.service.updateTechIconSlugs(
      dto.id,
      dto.icon_slugs,
    );
  }

  @Post('group')
  @ApiOperation({
    summary: 'Create a new tech (admin only)',
    description:
      "Requirement 7.5's manual-edit fallback: creates a tech, optionally mapping keywords to it and/or attaching it under a parent. Independent of the AI-suggestion approval path -- both call the same underlying data-access layer directly.",
  })
  @AdminOnly()
  createTech(@Body() dto: CreateTechDto) {
    return this.service.createTech(
      dto.id,
      dto.keywords,
      dto.category,
      dto.parent,
    );
  }

  /**
   * Declared after `group/icon-slugs` above (both are `PATCH`, and
   * `'group/:id'` would otherwise also match `/keyword/group/icon-slugs`):
   * NestJS/Express registers routes for the same HTTP method in declaration
   * order, so the more specific static path must come first.
   */
  @Patch('group/:id')
  @ApiOperation({
    summary: "Update an existing tech's keywords/category/parent (admin only)",
    description:
      "Requirement 7.5's manual-edit fallback: only the fields present in the body are changed. An explicit null on category/parent is a real value (category cleared / parent relationship removed), distinct from omitting the field.",
  })
  @AdminOnly()
  updateTech(
    @Param('id') id: string,
    @Body() dto: UpdateTechDto,
  ) {
    return this.service.updateTech(id, dto);
  }

  @Delete('group/:id')
  @ApiOperation({
    summary: 'Delete a tech (admin only)',
    description:
      "Requirement 7.5's manual-edit fallback: deletes the tech row. Its tech_keyword/tech_parent rows cascade-delete at the database level (supabase/schema.sql).",
  })
  @AdminOnly()
  deleteTech(@Param('id') id: string) {
    return this.service.deleteTech(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a bare (unmapped) keyword (admin only)',
    description:
      "Requirement 7.5's manual-edit fallback: deletes a keyword that is not currently mapped to any tech. Scoped to that case by the frontend's own UI logic.",
  })
  @AdminOnly()
  deleteKeyword(@Param('id') id: string) {
    return this.service.deleteKeyword(id);
  }
}
