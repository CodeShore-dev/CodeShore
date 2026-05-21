import { ListQuery, SupabaseTable } from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';
import { fetchList } from './utils';

export async function fetchKeywordGroups(
  query: ListQuery,
) {
  const supabase = getSupabaseClient();
  const builder = supabase
    .from('keyword_group')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseTable.KeywordGroup>(
    builder,
    query,
  );
}


export async function createKeywordGroup(
  id: string,
  category: string | null = null,
  parent: string | null = null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('keyword_group')
    .insert({ id, category, parent });

  if (error) {
    console.error(
      '[Supabase:createKeywordGroup] Error creating keyword group:',
      error,
    );
    throw error;
  }
  console.log(
    `[Supabase:createKeywordGroup] Created group "${id}"`,
  );
}

export async function updateKeywordGroup(
  id: string,
  category: string | null,
  parent: string | null
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('keyword_group')
    .update({ category, parent })
    .eq('id', id);

  if (error) {
    console.error(
      '[Supabase:updateKeywordGroup] Error updating keyword group:',
      error,
    );
    throw error;
  }
  console.log(
    `[Supabase:updateKeywordGroup] Updated group "${id}" with category "${category}" and parent "${parent}"`,
  );
}

export async function upsertKeywordGroups(
  keywordGroups: SupabaseTable.KeywordGroup[],
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('keyword_group')
    .upsert(keywordGroups);

  if (error) {
    console.error(
      '[Supabase:upsertKeywordGroups] Error inserting/updating keyword groups:',
      error,
    );
  } else {
    console.log(
      `[Supabase:upsertKeywordGroups] Successfully inserted/updated ${keywordGroups.length} keyword groups.`,
    );
  }
}

export async function resetKeywordGroups(
  keywordGroups: SupabaseTable.KeywordGroup[],
) {
  const supabase = getSupabaseClient();
  const { error: deleteError } = await supabase
    .from('keyword_group')
    .delete()
    .neq('id', '');

  if (deleteError) {
    console.error(
      '[Supabase:resetKeywordGroups] Error deleting keyword groups:',
      deleteError,
    );
  } else {
    console.log(
      `[Supabase:resetKeywordGroups] Successfully deleted keyword groups.`,
    );
  }

  const { error } = await supabase
    .from('keyword_group')
    .insert(keywordGroups);

  if (error) {
    console.error(
      '[Supabase:resetKeywordGroups] Error inserting keyword groups:',
      error,
    );
  } else {
    console.log(
      `[Supabase:resetKeywordGroups] Successfully inserted ${keywordGroups.length} keyword groups.`,
    );
  }
}

export async function deleteKeywordGroup(
  id: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('keyword_group')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(
      '[Supabase:deleteKeywordGroup] Error deleting keyword group:',
      error,
    );
    throw error;
  }
  console.log(
    `[Supabase:deleteKeywordGroup] Deleted group "${id}"`,
  );
}
