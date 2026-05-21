import { ListQuery, SupabaseView } from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';
import { fetchList } from './utils';

const supabase = getSupabaseClient();

export async function fetchMvCompany(
  query: ListQuery,
) {
  const builder = supabase
    .from('mv_company')
    .select('*', { count: 'exact' });

  return fetchList<SupabaseView.CompanyView>(builder, query);
}

export async function refreshMvCompany() {
  const { error } = await supabase.rpc('refresh_mv_company');

  if (error) {
    console.error(
      '[Supabase:refreshMvCompany] Error refreshing mv_company ',
      error,
    );
  } else {
    console.log(
      `[Supabase:refreshMvCompany] Successfully refreshed mv_company.`,
    );
  }
}
