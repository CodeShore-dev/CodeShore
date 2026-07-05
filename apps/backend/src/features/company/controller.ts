import {
  Controller as ControllerDecorator,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

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

  @Get(':companyId/tech-stats')
  @ApiOperation({
    summary:
      "Get a company's technology job counts sorted from most to least common",
    description:
      "Reads from the mv_company_tech materialized view, scoped to a single company. Returns the company's technologies with their job counts ordered by job_count descending. A companyId with no matching rows returns an empty list rather than an error. Example: /company/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tech-stats",
  })
  @ApiParam({
    name: 'companyId',
    description: 'The company ID to fetch technology job-count stats for',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  async getCompanyTechStats(
    @Param('companyId') companyId: string,
  ) {
    return this.service.getCompanyTechStats(companyId);
  }
}
