import {
  ListQuery,
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { fetchList } from './utils';

const supabase = getSupabaseClient();

export async function fetchJobsView(
  query: ListQuery,
  userId: string,
) {
  const wherePreference = query.where?.['preference'];
  const preference = wherePreference?.eq;

  const whereWithoutPreference = {
    ...query.where,
    preference: undefined,
  };

  if (preference) {
    const builder = supabase.rpc(
      'get_jobs_by_preference',
      { p_user_id: userId, p_preference: preference },
      { count: 'exact' },
    );

    return fetchList<SupabaseView.JobView>(builder, {
      ...query,
      where: whereWithoutPreference,
    });
  } else {
    const builder = supabase.rpc(
      'get_unreviewed_jobs',
      { p_user_id: userId },
      { count: 'exact' },
    );

    return fetchList<SupabaseView.JobView>(builder, {
      ...query,
      where: whereWithoutPreference,
    });
  }
}
