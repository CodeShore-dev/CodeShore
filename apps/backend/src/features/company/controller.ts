import {
  Controller as ControllerDecorator,
  Get,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
  @ApiOperation({
    summary: 'List companies (supports pagination, sorting and filtering)',
    description:
      'Reads from the company materialized view. Uses the shared QueryDto for from/to pagination, orders sorting and where filtering. A single response returns at most 18 items (enforced by @LimitQuery). Example: /company?from=0&to=18&orders=count:desc&where={"name":{"ilike":"%tech%"}}',
  })
  @LimitQuery(18)
  async getCompanies(@Query() query: QueryDto) {
    return this.service.getCompanies(query);
  }
}
