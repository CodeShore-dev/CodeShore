import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { extractKeywords } from '../format.keyword';
import { fetchJobKeywords } from './job_keyword';
import { fetchList } from './utils';
import { fetchKeywordGroupJoinKeywords } from './keyword_group_keyword';

const supabase = getSupabaseClient();

export async function fetchKeywords(query: ListQuery) {
  const builder = supabase
    .from('keyword_view')
    .select(query.select, { count: 'exact' });

  return fetchList<SupabaseTable.Keyword>(builder, query);
}

export async function resetKeywords() {
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
