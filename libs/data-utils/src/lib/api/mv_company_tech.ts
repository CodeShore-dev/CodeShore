import {
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';
import { ServiceLogger } from '@codeshore/service-logger';

export class MvCompanyTechService extends MaterializedViewService<SupabaseView.MvCompanyTech> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'mv_company_tech', logger);
  }
}
