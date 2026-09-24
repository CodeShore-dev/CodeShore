import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class JobPreferenceService extends TableService<
  SupabaseTable.JobPreference,
  // reason has a DB default ('未分類'), so writes may omit it.
  Omit<SupabaseTable.JobPreference, 'updated_at' | 'reason'> & {
    reason?: string;
  }
> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'job_preference', logger);
  }
  deleteByUserAndPreference(
    userId: string,
    preference: string,
  ) {
    return this.table
      .delete()
      .eq('user_id', userId)
      .eq('preference', preference);
  }
}
