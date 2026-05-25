import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchJobSources(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('job_source')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseTable.JobSource>(
    builder,
    query,
  ).then(x => ({
    ...x,
    result: x.result.map(y => ({
      ...y,
      host: new URL(y.url).host,
    })),
  }));
}
