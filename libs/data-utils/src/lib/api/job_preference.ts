import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

const supabase = getSupabaseClient();

export async function fetchJobPreferences(
  query: ListQuery,
) {
  const builder = supabase
    .from('job_preference')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseTable.JobPreference>(
    builder,
    query,
  );
}

export async function upsertJobPreference(
  jobId: string,
  preference: string,
  userId: string
) {
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
