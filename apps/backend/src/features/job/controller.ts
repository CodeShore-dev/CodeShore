import {
  Body,
  Controller as ControllerDecorator,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { Observable } from 'rxjs';

import {
  CurrentUser,
  OptionalAuth,
  Public,
  RequirePermission,
} from '../auth/auth.decorator';
import { LimitQuery } from '../query-limit.decorator';
import { QueryDto } from '../query.dto';
import { SetJobPreferenceDto } from './dto';
import { Service } from './service';

const name = 'job';

@ApiBearerAuth()
@ApiTags(name)
@ControllerDecorator(name)
export class Controller {
  constructor(@Inject(Service) private readonly service: Service) {}

  @Get('location')
  @Public()
  @ApiOperation({
    summary: 'Query job location groups',
    description:
      'Returns the materialized-view result of jobs grouped by location. Cached. Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. Public: does not depend on the caller. Example: /job/location?orders=count:desc',
  })
  async getLocationGroups(@Query() query: QueryDto) {
    return this.service.getLocationGroups(query);
  }

  @Get('location-tech')
  @Public()
  @ApiOperation({
    summary: 'Query job location technology stats',
    description:
      'Returns the materialized-view result of open jobs grouped by location and technology (mv_location_tech). Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. Public: does not depend on the caller. Example: /job/location-tech?where={"location":{"eq":"台北市中正區"}}&orders=job_count:desc',
  })
  async getLocationTechStats(@Query() query: QueryDto) {
    return this.service.getLocationTechStats(query);
  }

  @Get('location-salary')
  @Public()
  @ApiOperation({
    summary: 'Query job location salary stats',
    description:
      'Returns the materialized-view result of open jobs grouped by location and salary type (mv_location_salary), including job_count and avg_salary per group. Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. Public: does not depend on the caller. Example: /job/location-salary?where={"location":{"eq":"台北市信義區"}}',
  })
  async getLocationSalaryStats(@Query() query: QueryDto) {
    return this.service.getLocationSalaryStats(query);
  }

  @Get()
  @OptionalAuth()
  @ApiOperation({
    summary:
      'List jobs (personalized with preferences when signed in; supports pagination, sorting and filtering)',
    description:
      'Reads the job materialized view. Public/guest requests see every job with no preference scoping (equivalent to a brand-new user); a valid bearer token scopes the "preference" filter to that user. Pass where={"preference":{"eq":"like"}} to return only the jobs this user has marked as liked/disliked (empty for a guest). A single response returns at most 10 items (enforced by @LimitQuery). Example: /job?from=0&to=10&orders=posted_at:desc&where={"preference":{"eq":"like"}}',
  })
  @LimitQuery(10)
  async getMvJobs(
    @Query() query: QueryDto,
    @CurrentUser() user: User | undefined,
  ) {
    return this.service.getMvJobs(query, user?.id ?? null);
  }

  @Get('/preference/count')
  @ApiOperation({
    summary: 'Get the current user job counts per preference',
    description:
      'Returns the count of jobs the current user has marked under each preference (like / dislike). The result is cached for 60 seconds. Takes no parameters; the user is inferred from the Bearer token.',
  })
  async getJobPreferencedCount(@CurrentUser() user: User) {
    return this.service.getJobPreferencedCount(user.id);
  }

  @Delete('/preference/:preference')
  @ApiOperation({
    summary: 'Clear all of the current user marks under a preference',
    description:
      'Deletes all of the current user job marks under the given preference (like or dislike) and invalidates the related count cache.',
  })
  @ApiParam({
    name: 'preference',
    description: 'The preference type to clear',
    enum: ['like', 'dislike'],
    example: 'like',
  })
  async clearJobPreferences(
    @Param('preference') preference: string,
    @CurrentUser() user: User,
  ) {
    return this.service.clearJobPreferences(preference, user.id);
  }

  @Get('/preference/:preference/reasons')
  @ApiOperation({
    summary: 'List the current user reasons (sub-categories) under a preference',
    description:
      'Returns every reason in use by the current user under the given preference (like or dislike) with its job count, as [{ reason, job_count }]. The default reason "未分類" is included when it has jobs. Not cached. An unknown preference returns 400. The user is inferred from the Bearer token.',
  })
  @ApiParam({
    name: 'preference',
    description: 'The preference type whose reasons to list',
    enum: ['like', 'dislike'],
    example: 'like',
  })
  async getPreferenceReasons(
    @Param('preference') preference: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getPreferenceReasons(preference, user.id);
  }

  @Delete('/preference/:preference/reasons/:reason')
  @ApiOperation({
    summary: 'Delete one of the current user reasons (sub-categories)',
    description:
      'Moves every job the current user marked with this reason under the given preference back to the default reason "未分類"; the marks themselves are kept. The reason is URL-encoded in the path and trimmed; it must be 1-20 characters. Deleting the default reason, an empty or too-long name, or an unknown preference returns 400. Invalidates the related count cache and returns { updated } (the number of affected jobs).',
  })
  @ApiParam({
    name: 'preference',
    description: 'The preference type the reason belongs to',
    enum: ['like', 'dislike'],
    example: 'dislike',
  })
  @ApiParam({
    name: 'reason',
    description: 'The reason name to delete (URL-encoded)',
    example: '技能已符合',
  })
  async deletePreferenceReason(
    @Param('preference') preference: string,
    @Param('reason') reason: string,
    @CurrentUser() user: User,
  ) {
    return this.service.deletePreferenceReason(preference, reason, user.id);
  }

  @Patch('/preference/:jobId/:preference')
  @ApiOperation({
    summary: 'Set the current user preference for a single job',
    description:
      'Marks the given job with a preference (like or dislike) for the current user via upsert, and invalidates the related count cache. The body may carry an optional reason (sub-category); it is trimmed and must be 1-20 characters, otherwise 400. When omitted (including an empty body), the reason is reset to the default "未分類". Changing the preference replaces the whole record.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The job ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiParam({
    name: 'preference',
    description: 'The preference type to set',
    enum: ['like', 'dislike'],
    example: 'like',
  })
  async setJobPreference(
    @Param('jobId') jobId: string,
    @Param('preference') preference: string,
    @Body() body: SetJobPreferenceDto,
    @CurrentUser() user: User,
  ) {
    return this.service.setJobPreference(
      jobId,
      preference,
      user.id,
      body?.reason,
    );
  }

  @Sse('/crawl/:id')
  @RequirePermission()
  crawl(@Param('id') id: string): Observable<MessageEvent> {
    return this.service.spawnCrawlProcessSse(id);
  }
}
