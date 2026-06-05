import {
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';
import { ServiceLogger } from '@codeshore/service-logger';

export class MvCompanyService extends MaterializedViewService<SupabaseView.MvCompany> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'mv_company', logger);
  }
}
