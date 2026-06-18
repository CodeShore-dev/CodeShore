import {
  ListResponse,
  SupabaseView,
} from '@codeshore/data-types';

import { ListQuery } from '../../@types';
import { httpClient } from '../../httpClient';

export const DEFAULT_JOB_ORDERS =
  'avg_salary:desc;min_salary:desc;max_salary:desc;updated_at:desc';

export const fetchJobs = async (
  query: ListQuery,
  orders: string = DEFAULT_JOB_ORDERS,
) => {
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvJob>
  >('/api/job', {
    params: {
      ...query,
      orders,
    },
  });
  return res.data;
};

export const fetchJobPreferencedCount = async () => {
  const res = await httpClient.get<{
    liked_count: number;
    disliked_count: number;
  }>('/api/job/preference/count');
  return res.data;
};

export const setJobPreference = async (
  jobId: string,
  preference: string,
) => {
  const res = await httpClient.patch(
    `/api/job/preference/${jobId}/${preference}`,
    {},
  );
  return res.data;
};

export const clearJobPreferences = async (
  preference: string,
) => {
  const res = await httpClient.delete(
    `/api/job/preference/${preference}`,
  );
  return res.data;
};

export const fetchLocationGroups = async () => {
  const res = await httpClient.get<
    ListResponse<SupabaseView.MvLocationGroup>
  >('/api/job/location', {
    params: {
      from: 0,
      to: -1,
      orders: 'count:desc;location',
    },
  });
  return res.data;
};

export const createCrawlEventSource = (
  id: string,
): EventSource => {
  const { baseURL } = httpClient.defaults;
  const token = localStorage.getItem('token');
  let url = `${baseURL}/api/job/crawl/${encodeURIComponent(id)}`;
  if (token) {
    url += `?token=${encodeURIComponent(token)}`;
  }
  return new EventSource(url);
};
