import {
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';
import { ServiceLogger } from '@codeshore/service-logger';

export class MvLocationSalaryService extends MaterializedViewService<SupabaseView.MvLocationSalary> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'mv_location_salary', logger);
  }
}
