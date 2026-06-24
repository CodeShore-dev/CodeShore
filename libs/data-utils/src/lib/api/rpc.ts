import type { SupabaseFunction } from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

export async function getJobCount() {
  return getSupabaseClient().rpc('get_job_count');
}

export async function getJobCrawlStats(
  days = 7,
): Promise<SupabaseFunction.JobCrawlStats | null> {
  const { data } = await getSupabaseClient().rpc(
    'get_job_crawl_stats',
    { p_days: days },
  );
  return data?.[0] ?? null;
}

export async function getJobUpdateDateCounts(): Promise<
  SupabaseFunction.JobUpdateDateCount[]
> {
  const { data } = await getSupabaseClient().rpc(
    'get_job_update_date_counts',
  );
  return data ?? [];
}

export async function getJobPreferenceCount(
  userId: string,
): Promise<SupabaseFunction.JobPreferenceCount> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.rpc(
    'get_job_preference_count',
    {
      p_user_id: userId,
    },
  );
  return data;
}

/**
 * job_keyword + tech => keyword
 */
export async function resetKeywords() {
  return getSupabaseClient().rpc('reset_keywords');
}
