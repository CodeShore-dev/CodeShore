import {
  ListQuery,
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

const supabase = getSupabaseClient();

export async function fetchMvKeywordGroup(
  query: ListQuery,
) {
  const builder = supabase
    .from('mv_keyword_group')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseView.KeywordGroupView>(
    builder,
    query,
  );
}

export async function refreshMvKeywordGroup() {
  const { error } = await supabase.rpc('refresh_mv_keyword_group');

  if (error) {
    console.error(
      '[Supabase:refreshMvKeywordGroup] Error refreshing mv_keyword_group ',
      error,
    );
  } else {
    console.log(
      `[Supabase:refreshMvKeywordGroup] Successfully refreshed mv_keyword_group.`,
    );
  }
}
