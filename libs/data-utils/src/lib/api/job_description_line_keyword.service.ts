import { getSupabaseClient } from '@codeshore/supabase';

import { TableService } from '../shared-services/supabase/table.service';
import { SupabaseTable } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';

export class JobDescriptionLineKeywordService extends TableService<SupabaseTable.JobDescriptionLineKeyword>{
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(),'job_description_line_keyword', logger);
  }
}
