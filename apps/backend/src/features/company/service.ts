import { Injectable } from '@nestjs/common';

import {
  MvCompanyService,
  MvCompanyTechService,
} from '@codeshore/data-utils';

import { QueryDto } from '../query.dto';

@Injectable()
export class Service {
  constructor(
    private readonly mvCompanyService: MvCompanyService,
    private readonly mvCompanyTechService: MvCompanyTechService,
  ) {}

  async getCompanies(query: QueryDto) {
    return this.mvCompanyService.fetch(query);
  }

  async getCompanyTechStats(companyId: string) {
    return this.mvCompanyTechService.fetchAll({
      where: { company_id: { eq: companyId } },
      orders: [{ column: 'job_count', ascending: false }],
    });
  }
}
