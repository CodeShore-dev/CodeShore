import { getSupabaseClient } from '@codeshore/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseFunction } from '@codeshore/data-types';

const supabaseClient = getSupabaseClient()

export async function getSalaryRange(): Promise<SupabaseFunction.SalaryRange> {
  const { data } = await supabaseClient.rpc('get_job_salary_stats');
  return data;
}

export async function getJobCount(): Promise<SupabaseFunction.JobCount> {
  const { data } = await supabaseClient.rpc('get_job_count');
  return data;
}

export async function getTechStats(): Promise<SupabaseFunction.TechStat[]> {
  const { data } = await supabaseClient.rpc('get_tech_salary_stats', { p_limit: 20 });
  return data ?? [];
}

export async function getTechComboStats(): Promise<SupabaseFunction.TechComboStat[]> {
  const { data } = await supabaseClient.rpc('get_tech_combo_stats', { p_limit: 15 });
  return data ?? [];
}

export async function getSalaryStats(): Promise<SupabaseFunction.SalaryStat[]> {
  const { data } = await supabaseClient.rpc('get_salary_stats');
  return data ?? [];
}

export async function getJobPreferenceCount(
  userId: string,
): Promise<SupabaseFunction.JobPreferenceCount> {
  const { data } = await supabaseClient.rpc('get_job_preference_count', {
    p_user_id: userId,
  });
  return data;
}
