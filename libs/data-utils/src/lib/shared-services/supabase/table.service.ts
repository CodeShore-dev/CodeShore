import {
  PostgrestError,
  SupabaseClient,
} from '@supabase/supabase-js';

import { ServiceLogger } from '@codeshore/service-logger';

import { BaseService, Options } from './base.service';
import { deleteAll } from './utils';

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
  update(record: Partial<R>) {
    const { id, ...values } = record;
    return this.table
      .update(values as any)
      .eq(this.options.delete_update?.idField || 'id', id);
  }
  updateMultiple(records: Partial<R>[]) {
    return Promise.all(records.map(this.update));
  }
  delete(id: string) {
    return this.table
      .delete()
      .eq(this.options.delete_update?.idField || 'id', id);
  }
  async reset(records: R[]) {
    await deleteAll(
      this.table,
      this.options.delete_update?.idField,
    );
    return await this.table.insert(records as any[]);
  }
}
