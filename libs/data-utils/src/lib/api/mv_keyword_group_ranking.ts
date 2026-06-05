import {
  ListQuery,
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchMvKeywordGroupRanking(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('mv_keyword_group_ranking')
    .select(query.select, { count: 'exact' });

  return fetchList<SupabaseView.MvKeywordGroupRanking>(builder, query);
}

export async function refreshMvKeywordGroupRanking() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc(
    'mv_keyword_group_ranking',
  );

  if (error) {
    console.error(
      '[Supabase:refreshMvKeywordGroupRanking] Error refreshing mv_keyword_group_ranking ',
      error,
    );
  } else {
    console.log(
      `[Supabase:refreshMvKeywordGroupRanking] Successfully refreshed mv_keyword_group_ranking.`,
    );
  }
}
