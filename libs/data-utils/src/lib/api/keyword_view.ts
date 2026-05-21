import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';


export async function fetchKeywords(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
  .from('keyword_view')
  .select(query.select, { count: 'exact' });

  return fetchList<SupabaseTable.Keyword>(builder, query);
}

export async function resetKeywords() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('reset_keywords');

  if (error) {
    console.error(
      '[Supabase:resetKeywords] Error resetting keywords ',
      error,
    );
  } else {
    console.log(
      `[Supabase:resetKeywords] Successfully reset keywords.`,
    );
  }
}
