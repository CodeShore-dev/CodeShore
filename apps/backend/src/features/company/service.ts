import { Injectable } from '@nestjs/common';

import {
  fetchMvCompany,
} from '@codeshore/data-utils';
import { QueryDto } from '../query.dto';

@Injectable()
export class Service {
  async getCompanies(query: QueryDto) {
    return fetchMvCompany(query);
  }
}
