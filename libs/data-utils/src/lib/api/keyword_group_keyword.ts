import {
  ListQuery,
  SupabaseTable,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

export async function fetchKeywordGroupKeywords(query: ListQuery) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('keyword_group_keyword')
    .select(query.select, { count: 'exact' });

  return fetchList<SupabaseTable.KeywordGroupKeyword>(builder, query);
}

export async function createKeywordGroupKeyword(
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
      '[Supabase:createKeywordGroupKeyword] Error creating keyword group keyword:',
      error,
    );
    throw error;
  }
  console.log(
    `[Supabase:createKeywordGroupKeyword] Created between keywords "${keywords.join()}" <-> group "${keyword_group}"`,
  );
}

export async function updateKeywordGroupKeyword(
  keyword_group: string,
  keywords: string[],
): Promise<void> {
  await deleteKeywordGroupKeyword(keyword_group);
  return createKeywordGroupKeyword(
    keyword_group,
    keywords,
  );
}

export async function deleteKeywordGroupKeyword(
  keyword_group: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('keyword_group_keyword')
    .delete()
    .eq('keyword_group', keyword_group);

  if (error) {
    console.error(
      '[Supabase:deleteKeywordGroupKeyword] Error deleting keyword group <-> keyword:',
      error,
    );
  } else {
    console.log(
      `[Supabase:deleteKeywordGroupKeyword] Successfully deleted keyword group <-> keyword.`,
    );
  }
}
