import {
  ListQuery,
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

const supabase = getSupabaseClient();

export async function fetchKeywordGroupCategories(
  query: ListQuery,
) {
  const builder = supabase
    .from('mv_keyword_group_category')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseView.KeywordGroupCategory>(
    builder,
    query,
  );
}
