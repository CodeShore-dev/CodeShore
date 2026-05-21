import { SupabaseFunction } from '@codeshore/data-types';

import { httpClient } from '../../httpClient';

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

export const fetchTechStats = async () => {
  const res = await httpClient.get<
    SupabaseFunction.TechStat[]
  >('/api/tech-stats');
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
