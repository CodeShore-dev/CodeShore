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
  async getKeywordGroupView(@Query() query: QueryDto) {
    return this.service.getKeywordGroupView(query);
  }

  @Get('group/category')
  async getKeywordGroupCategories(
    @Query() query: QueryDto,
  ) {
    return this.service.getKeywordGroupCategories(query);
  }

  @Post('group')
  @AdminOnly()
  async createKeywordGroup(
    @Body()
    body: {
      id: string;
      keywords?: string[];
      category?: string | null;
      parent?: string | null;
    },
  ) {
    return this.service.createKeywordGroup(
      body.id,
      body.keywords,
      body.category,
      body.parent,
    );
  }

  @Patch('group/:id')
  @AdminOnly()
  async updateKeywordGroup(
    @Param('id') id: string,
    @Body()
    body: {
      keywords?: string[];
      category?: string | null;
      parent?: string | null;
    },
  ) {
    return this.service.updateKeywordGroup(id, body.keywords, body.category, body.parent);
  }

  @Delete('group/:id')
  @AdminOnly()
  async deleteKeywordGroup(@Param('id') id: string) {
    return this.service.deleteKeywordGroup(id);
  }

  @Delete(':id')
  @AdminOnly()
  async deleteKeyword(@Param('id') id: string) {
    return this.service.deleteKeyword(id);
  }

  @Post('group/reset')
  @AdminOnly()
  resetJobKeywords_Keywords_JobKeywordGroup() {
    return this.service.resetJobKeywords_Keywords_JobKeywordGroup();
  }
}
