import { SupabaseClient } from '@supabase/supabase-js';

import { ServiceLogger } from '@codeshore/service-logger';

import { BaseService } from './base.service';

type Options = {
  select?: {
    head?: boolean;
    count?:
      | 'exact'
      | 'planned'
      | 'estimated'
      | (string & {});
  };
};

export class MaterializedViewService<
  T extends Record<string, any>,
> extends BaseService<T> {
  constructor(
    client: SupabaseClient,
    tableName: string,
    logger?: ServiceLogger,
    options?: Options,
  ) {
    super(client, tableName, logger, options);
  }
  refresh() {
    return this.client.rpc('refresh_' + this.tableName);
  }
}
