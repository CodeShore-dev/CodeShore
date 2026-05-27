import {
  Controller as ControllerDecorator,
  Get,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { LimitQuery } from '../query-limit.decorator';
import { QueryDto } from '../query.dto';
import { Service } from './service';

const name = 'company';

@ApiBearerAuth()
@ApiTags(name)
@ControllerDecorator(name)
export class Controller {
  constructor(private readonly service: Service) {}

  @Get()
  @LimitQuery(18)
  async getCompanies(@Query() query: QueryDto) {
    return this.service.getCompanies(query);
  }
}
