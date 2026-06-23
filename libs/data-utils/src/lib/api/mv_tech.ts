import {
  SupabaseView,
} from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';
import { getSupabaseClient } from '@codeshore/supabase';

import { MaterializedViewService } from '../shared-services/supabase/materialized-view.service';

export class MvTechService extends MaterializedViewService<SupabaseView.MvTech> {
  constructor(logger?: ServiceLogger) {
    super(
      getSupabaseClient(),
      'mv_tech',
      logger,
    );
  }
}
