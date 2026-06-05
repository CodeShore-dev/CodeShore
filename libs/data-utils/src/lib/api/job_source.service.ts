import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';

export class JobSourceService extends TableService<SupabaseTable.JobSource> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'job_source', logger);
  }
}
