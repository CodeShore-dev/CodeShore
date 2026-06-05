import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';
import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';

export class JobKeywordService extends TableService<SupabaseTable.Job_.Keyword>{
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(),'job_keyword', logger);
  }
}
