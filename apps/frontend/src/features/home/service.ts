import {
  ListResponse,
  SupabaseFunction,
  SupabaseView,
} from '@codeshore/data-types';

import { httpClient } from '../../httpClient';
import { ListQuery } from '../../@types';

export const fetchSalaryRange = async () => {
  const res =
    await httpClient.get<SupabaseFunction.SalaryRange>(
      '/api/salary-range',
    );
  return res.data;
};

export const fetchJobCount = async () => {
  const res = await httpClient.get<
    SupabaseFunction.JobCount[]
  >('/api/job-count');
  return res.data;
};

export const fetchMvKeywordGroupRanking = async (query: ListQuery) => {
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvKeywordGroupRanking>
  >('/api/keyword/group/ranking', { params: query });
  return res.data;
};

export const fetchTechComboStats = async () => {
  const res = await httpClient.get<
    SupabaseFunction.TechComboStat[]
  >('/api/tech-combo-stats');
  return res.data;
};

export const fetchSalaryStats = async () => {
  const res = await httpClient.get<
    SupabaseFunction.SalaryStat[]
  >('/api/salary-stats');
  return res.data;
};
