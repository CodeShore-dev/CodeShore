import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

const supabase = getSupabaseClient();

export async function fetchJobs(query: ListQuery) {
  const builder = supabase
    .from('job')
    .select(query.select, { count: 'exact' });

  return fetchList<SupabaseTable.Job>(builder, query);
}

export async function upsertJobs(
  jobs: SupabaseTable.Job[],
) {
  const { error } = await supabase
    .from('job')
    .upsert(jobs, { onConflict: 'id' });

  if (error) {
    console.error(
      '[Supabase:upsertJobs] Error inserting/updating jobs:',
      error,
    );
  } else {
    console.log(
      `[Supabase:upsertJobs] Successfully inserted/updated ${jobs.length} jobs.`,
    );
  }
}
