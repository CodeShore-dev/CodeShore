import {
  ListQuery,
  SupabaseView,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';
import { fetchListRPC } from '../shared-services/supabase/utils';

export class MvJobService extends TableService<SupabaseView.MvJob> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'mv_job', logger);
  }
  fetchMvJobsByUserAndPreference(
    query: ListQuery,
    userId: string,
  ) {
    const preference = query.where?.['preference']?.eq;

    const whereWithoutPreferenceFilter = {
      ...query.where,
      preference: undefined,
    };

    if (preference) {
      const functionName = 'get_jobs_by_preference';
      const builder = this.client.rpc(
        functionName,
        { p_user_id: userId, p_preference: preference },
        { count: 'exact' },
      );

      return fetchListRPC<SupabaseView.MvJob>(
        builder,
        {
          ...query,
          where: whereWithoutPreferenceFilter,
        },
        {
          logger: this.logger,
          name: functionName,
          caller: this.tableName,
        },
      );
    } else {
      const functionName = 'get_unreviewed_jobs';
      const builder = this.client.rpc(
        functionName,
        { p_user_id: userId },
        { count: 'exact' },
      );

      return fetchListRPC<SupabaseView.MvJob>(
        builder,
        {
          ...query,
          where: whereWithoutPreferenceFilter,
        },
        {
          logger: this.logger,
          name: functionName,
          caller: this.tableName,
        },
      );
    }
  }
}
