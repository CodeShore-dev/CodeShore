import { SupabaseTable } from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

export async function upsertCompanies(
  companies: SupabaseTable.Company[],
) {
  if (!companies || companies.length === 0) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase
    .from('company')
    .upsert(companies, {
      onConflict: 'id',
      ignoreDuplicates: true,
    });

  if (error) {
    console.error(
      '[Supabase:upsertCompanies] Error inserting companies:',
      error,
    );
  } else {
    console.log(
      `[Supabase:upsertCompanies] Successfully inserted companies (ignored existing ones).`,
    );
  }
}
