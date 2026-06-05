import type { SupabaseFunction } from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

export async function getJobCount() {
  return getSupabaseClient().rpc('get_job_count');
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
 * job_keyword + keyword_group => keyword
 */
export async function resetKeywords() {
  return getSupabaseClient().rpc('reset_keywords');
}
