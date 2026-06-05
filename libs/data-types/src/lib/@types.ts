import { SupabaseTable } from './supabase.@types';

export type Entry = {
  company: SupabaseTable.Company;
  job: SupabaseTable.Job;
  jobKeyword: SupabaseTable.Job_.Keyword;
};

export type ListQuery = {
  from?: number;
  to?: number;
  orders?: {
    column: string;
    ascending: boolean;
  }[];
  where?: Record<string, any>;
  select?: string;
};

export type ListResponse<T> = {
  result: T[];
  count: number;
  searchParams: string;
};

