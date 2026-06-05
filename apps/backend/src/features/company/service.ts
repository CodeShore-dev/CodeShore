import { Injectable } from '@nestjs/common';

import { MvCompanyService } from '@codeshore/data-utils';

import { QueryDto } from '../query.dto';

@Injectable()
export class Service {
  constructor(
    private readonly mvCompanyService: MvCompanyService,
  ) {}

  async getCompanies(query: QueryDto) {
    return this.mvCompanyService.fetch(query);
  }
}
