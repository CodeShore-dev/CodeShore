import {
  ListResponse,
  SupabaseView,
} from '@codeshore/data-types';

import { ListQuery } from '../../@types';
import { httpClient } from '../../httpClient';

export const fetchCompanies = async (query?: ListQuery) => {
  const { data } = await httpClient.get<
    ListResponse<SupabaseView.MvCompany>
  >('/api/company', {
    params: {
      ...query,
      orders: 'job_count:desc;company_id',
    },
  });
  return data;
};

