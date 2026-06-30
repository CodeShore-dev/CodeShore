import {
  ListResponse,
  SupabaseFunction,
  SupabaseView,
} from '@codeshore/data-types';

import { ListQuery } from '../../@types';
import { httpClient } from '../../httpClient';

export const fetchMvSalaryTypeMedianRatio = async () => {
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvSalaryTypeMedianRatio>
  >('/api/salary/type/median/ratio');
  return res.data;
};

export const fetchMvSalaryRangeMultiplier = async () => {
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvSalaryRangeMultiplier>
  >('/api/salary/range/multiplier');
  return res.data;
};

export const fetchJobCount = async () => {
  const res = await httpClient.get<
    SupabaseFunction.JobCount[]
  >('/api/job-count');
  return res.data;
};

export const fetchJobHostStatistics = async () => {
  const res = await httpClient.get<
    SupabaseFunction.JobHostStatistic[]
  >('/api/job-host-statistics');
  return res.data;
};

export const fetchMvTechRanking = async (
  query: ListQuery,
) => {
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvTechRanking>
  >('/api/keyword/group/ranking', { params: query });
  return res.data;
};

export const fetchMvTechComboStats = async (
  query?: ListQuery,
) => {
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvTechComboStats>
  >('/api/keyword/group/tech-combo-stats', {
    params: {
      ...query,
    },
  });
  return res.data;
};
