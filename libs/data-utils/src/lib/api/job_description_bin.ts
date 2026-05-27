import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchJobDescriptionBins(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('job_description_bin')
    .select(query.select, { count: 'exact' });

  return fetchList<SupabaseTable.JobDescriptionBin>(builder, query);
}
