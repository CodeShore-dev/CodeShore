import {
  ListQuery,
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchMvLocationGroup(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('mv_location_group')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseView.LocationGroupView>(builder, query);
}
