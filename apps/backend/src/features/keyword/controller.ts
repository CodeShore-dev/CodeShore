import {
  Controller as ControllerDecorator,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
  async getMvKeywordGroup(@Query() query: QueryDto) {
    return this.service.getMvKeywordGroup(query);
  }

  @Get('group/category')
  async getKeywordGroupCategories(
    @Query() query: QueryDto,
  ) {
    return this.service.getKeywordGroupCategories(query);
  }

  @Get('group/ranking')
  async getKeywordGroupRanking(
    @Query() query: QueryDto,
  ) {
    return this.service.getMvKeywordGroupRanking(query);
  }

  @Post('group/reset')
  @AdminOnly()
  resetJobKeywords_Keywords_JobKeywordGroup() {
    return this.service.resetJobKeywords_Keywords_JobKeywordGroup();
  }
}
