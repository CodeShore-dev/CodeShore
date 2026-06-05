import {
  SupabaseClient,
} from '@supabase/supabase-js';

import { ServiceLogger } from '@codeshore/service-logger';

import { BaseService } from './base.service';
import { deleteAll } from './utils';

type Options = {
  upsert?: {
    onConflict?: string;
    ignoreDuplicates?: boolean;
    count?:
      | 'exact'
      | 'planned'
      | 'estimated'
      | (string & {});
    defaultToNull?: boolean;
  };
  select?: {
    head?: boolean;
    count?:
      | 'exact'
      | 'planned'
      | 'estimated'
      | (string & {});
  };
  delete?: {
    idField?: string;
    count?:
      | 'exact'
      | 'planned'
      | 'estimated'
      | (string & {});
  };
};

export class TableService<
  T extends Record<string, any>,
  R extends Partial<T> = T,
> extends BaseService<T> {
  constructor(
    client: SupabaseClient,
    tableName: string,
    logger?: ServiceLogger,
    options?: Options,
  ) {
    super(client, tableName, logger, options);
  }
  upsert(records: R[]) {
    return this.table.upsert(
      records as any[],
      this.options.upsert,
    );
  }
  delete(id: string) {
    return this.table
      .delete()
      .eq(this.options.delete?.idField || 'id', id);
  }
  async reset(records: R[]) {
    await deleteAll(
      this.table,
      this.options.delete?.idField,
    );
    return await this.table.insert(records as any[]);
  }
}
