import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchJobPreferences(
  query: ListQuery,
) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('job_preference')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseTable.JobPreference>(
    builder,
    query,
  );
}

export async function deleteJobPreferences(
  preference: string,
  userId: string,
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('job_preference')
    .delete()
    .eq('user_id', userId)
    .eq('preference', preference);

  if (error) {
    console.error(
      '[Supabase:deleteJobPreferences] Error deleting job preferences:',
      error,
    );
    throw error;
  } else {
    console.log(
      `[Supabase:deleteJobPreferences] Successfully deleted "${preference}" preferences for user ${userId}.`,
    );
  }
}

export async function upsertJobPreference(
  jobId: string,
  preference: string,
  userId: string
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('job_preference')
    .upsert({
      job_id: jobId,
      user_id: userId,
      preference,
    });

  if (error) {
    console.error(
      '[Supabase:createJobPreference] Error creating job preference:',
      error,
    );
  } else {
    console.log(
      `[Supabase:createJobPreference] Successfully created job preference for job ${jobId}.`,
    );
  }
}
