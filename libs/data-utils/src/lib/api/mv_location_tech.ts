import {
  SupabaseView,
} from '@codeshore/data-types';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';
import { ServiceLogger } from '@codeshore/service-logger';

export class MvLocationTechService extends MaterializedViewService<SupabaseView.MvLocationTech> {
  constructor(logger?: ServiceLogger) {
    super(getSupabaseClient(), 'mv_location_tech', logger);
  }
}
