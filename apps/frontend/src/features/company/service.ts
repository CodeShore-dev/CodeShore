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

// Per-technology job counts for a single company (task 6.3 / Req 5.1, 5.2,
// 5.4). Backend endpoint (task 1.7) already sorts by job_count desc.
export const fetchCompanyTechStats = async (companyId: string) => {
  const { data } = await httpClient.get<
    ListResponse<SupabaseView.MvCompanyTech>
  >(`/api/company/${companyId}/tech-stats`);
  return data;
};

