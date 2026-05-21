import { ListResponse, SupabaseView } from '@codeshore/data-types';

import { ListQuery } from '../../@types';
import { httpClient } from '../../httpClient';

export const fetchCompanies = async (
  query?: ListQuery,
): Promise<ListResponse<SupabaseView.CompanyView>> => {
  const { data } = await httpClient.get<
    ListResponse<SupabaseView.CompanyView>
  >('/api/company', { params: query });
  return data;
};
