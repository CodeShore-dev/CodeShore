import { SupabaseView } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvLocationGroupService extends MaterializedViewService<SupabaseView.MvLocationGroup> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'mv_location_group', logger);
  }
}

