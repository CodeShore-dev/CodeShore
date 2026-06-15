import { ListResponse } from '@codeshore/data-types';

import { httpClient } from '../../httpClient';

export type CrawlStats = {
  new_jobs_date: string;
  new_jobs_count: number;
  updated_jobs_date: string;
  updated_jobs_count: number;
};

export type AnomalyJob = {
  id: string;
  title: string;
  detail_link: string;
  updated_at: string;
  salary?: string;
  salary_type?: string;
  min_salary?: number;
  max_salary?: number;
  salary_manual?: boolean;
  location?: string;
};

export type LocationAnomalyType =
  | 'blank'
  | 'unmapped'
  | 'malformed';

export type UpdateDateCount = {
  updated_date: string;
  count: number;
};

export type CrawlMode =
  | 'crawl'
  | 'fresh'
  | 'recrawl-ids'
  | 'recrawl-anomaly'
  | 'recrawl-cond'
  | 'recrawl-dates';

export type AnomalyKind =
  | 'salary'
  | 'empty-description'
  | 'location-blank'
  | 'location-unmapped'
  | 'location-malformed';

const BASE = '/api/admin/job';

export const fetchCrawlStats = async (days = 7) => {
  const res = await httpClient.get<CrawlStats>(
    `${BASE}/stats`,
    { params: { days } },
  );
  return res.data;
};

export const fetchSalaryAnomalies = async (params: {
  from: number;
  to: number;
  monthCeil: number;
  yearCeil: number;
}) => {
  const res = await httpClient.get<
    ListResponse<AnomalyJob>
  >(`${BASE}/anomaly/salary`, { params });
  return res.data;
};

export const fetchEmptyDescriptionJobs = async (params: {
  from: number;
  to: number;
}) => {
  const res = await httpClient.get<
    ListResponse<AnomalyJob>
  >(`${BASE}/anomaly/empty-description`, { params });
  return res.data;
};

export const fetchLocationAnomalies = async (params: {
  from: number;
  to: number;
  type: LocationAnomalyType;
  maxLen: number;
}) => {
  const res = await httpClient.get<
    ListResponse<AnomalyJob>
  >(`${BASE}/anomaly/location`, { params });
  return res.data;
};

export const fetchUpdateDateCounts = async () => {
  const res = await httpClient.get<UpdateDateCount[]>(
    `${BASE}/update-date-counts`,
  );
  return res.data;
};

export const updateJobSalary = async (
  id: string,
  minSalary: number,
  maxSalary: number,
  salaryType: 'month' | 'year',
) => {
  const res = await httpClient.patch(
    `${BASE}/${encodeURIComponent(id)}/salary`,
    {
      min_salary: minSalary,
      max_salary: maxSalary,
      salary_type: salaryType,
    },
  );
  return res.data;
};

export type CrawlParams = {
  mode: CrawlMode;
  ids?: string[];
  kind?: AnomalyKind;
  monthCeil?: number;
  yearCeil?: number;
  maxLen?: number;
  where?: string;
  dates?: string[];
};

export const createAdminCrawlEventSource = (
  params: CrawlParams,
): EventSource => {
  const { baseURL } = httpClient.defaults;
  const token = localStorage.getItem('token');
  const search = new URLSearchParams();
  search.set('mode', params.mode);
  if (params.ids?.length)
    search.set('ids', params.ids.join(','));
  if (params.kind) search.set('kind', params.kind);
  if (params.monthCeil != null)
    search.set('monthCeil', String(params.monthCeil));
  if (params.yearCeil != null)
    search.set('yearCeil', String(params.yearCeil));
  if (params.maxLen != null)
    search.set('maxLen', String(params.maxLen));
  if (params.where) search.set('where', params.where);
  if (params.dates?.length)
    search.set('dates', params.dates.join(','));
  if (token) search.set('token', token);
  return new EventSource(
    `${baseURL}${BASE}/crawl?${search.toString()}`,
  );
};
