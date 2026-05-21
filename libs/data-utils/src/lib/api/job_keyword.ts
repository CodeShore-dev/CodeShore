import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchJobKeywords(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase.from('job_keyword').select(
    `
      id,
      keywords,
      job!inner (
        company_id,
        closed
      )`,
    { count: 'exact' },
  );

  return fetchList<SupabaseTable.JobKeyword>(
    builder,
    query,
  );
}

export async function upsertJobKeywords(
  jobKeywords: Omit<SupabaseTable.JobKeyword, 'job'>[],
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('job_keyword')
    .upsert(jobKeywords);

  if (error) {
    console.error(
      '[Supabase:upsertJobs] Error inserting/updating job keywords:',
      error,
    );
  } else {
    console.log(
      `[Supabase:upsertJobs] Successfully inserted/updated ${jobKeywords.length} job keywords.`,
    );
  }
}
