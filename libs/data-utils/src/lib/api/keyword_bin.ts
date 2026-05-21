import { getSupabaseClient } from '@codeshore/supabase';

const supabase = getSupabaseClient();

export async function createKeywordBin(keyword: string) {
  const { error } = await supabase
    .from('keyword_bin')
    .insert({
      id: keyword,
    });

  if (error) {
    console.error(
      '[Supabase:createKeywordBin] Error creating keyword bin',
      error,
    );
  } else {
    console.log(
      `[Supabase:createKeywordBin] Successfully created keyword bin for keyword ${keyword}.`,
    );
  }
}
