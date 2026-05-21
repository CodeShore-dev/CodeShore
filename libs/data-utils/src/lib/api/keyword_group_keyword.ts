import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchKeywordGroupJoinKeywords(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('keyword_group_keyword')
    .select(query.select, { count: 'exact' });

  return fetchList<SupabaseTable.KeywordGroupJoinKeyword>(builder, query);
}

export async function createKeywordGroupJoinKeyword(
  keyword_group: string,
  keywords: string[],
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('keyword_group_keyword')
    .insert(
      keywords.map(keyword => ({ keyword, keyword_group })),
    );

  if (error) {
    console.error(
      '[Supabase:createKeywordGroupJoinKeyword] Error creating keyword group join keyword:',
      error,
    );
    throw error;
  }
  console.log(
    `[Supabase:createKeywordGroupJoinKeyword] Created join between keywords "${keywords.join()}" and group "${keyword_group}"`,
  );
}

export async function updateKeywordGroupJoinKeyword(
  keyword_group: string,
  keywords: string[],
): Promise<void> {
  await deleteKeywordGroupJoinKeyword(keyword_group);
  return createKeywordGroupJoinKeyword(
    keyword_group,
    keywords,
  );
}

export async function deleteKeywordGroupJoinKeyword(
  keyword_group: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('keyword_group_keyword')
    .delete()
    .eq('keyword_group', keyword_group);

  if (error) {
    console.error(
      '[Supabase:deleteKeywordGroupJoinKeyword] Error deleting keyword group join keyword:',
      error,
    );
  } else {
    console.log(
      `[Supabase:deleteKeywordGroupJoinKeyword] Successfully deleted keyword group join keyword.`,
    );
  }
}
