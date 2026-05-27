import {
  Controller as ControllerDecorator,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { Observable } from 'rxjs';

import { CurrentUser, RequirePermission } from '../auth/auth.decorator';
import { LimitQuery } from '../query-limit.decorator';
import { QueryDto } from '../query.dto';
import { Service } from './service';

const name = 'job';

@ApiBearerAuth()
@ApiTags(name)
@ControllerDecorator(name)
export class Controller {
  constructor(private readonly service: Service) {}

  @Get('location')
  async getLocationGroups(@Query() query: QueryDto) {
    return this.service.getLocationGroups(query);
  }

  @Get()
  @LimitQuery(10)
  async getJobs(
    @Query() query: QueryDto,
    @CurrentUser() user: User,
  ) {
    return this.service.getJobs(query, user.id);
  }

  @Get('/preference/count')
  async getJobPreferencedCount(@CurrentUser() user: User) {
    return this.service.getJobPreferencedCount(user.id);
  }

  @Delete('/preference/:preference')
  async clearJobPreferences(
    @Param('preference') preference: string,
    @CurrentUser() user: User,
  ) {
    return this.service.clearJobPreferences(preference, user.id);
  }

  @Patch('/preference/:jobId/:preference')
  async setJobPreference(
    @Param('jobId') jobId: string,
    @Param('preference') preference: string,
    @CurrentUser() user: User,
  ) {
    return this.service.setJobPreference(jobId, preference, user.id);
  }

  @Sse('/crawl/:id')
  @RequirePermission()
  crawl(@Param('id') id: string): Observable<MessageEvent> {
    return this.service.spawnCrawlProcessSse(id);
  }
}
