import {
  PostgrestError,
  SupabaseClient,
} from '@supabase/supabase-js';

import { ServiceLogger } from '@codeshore/service-logger';

import { BaseService, Options } from './base.service';
import { deleteAll, deleteWhereIn } from './utils';

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
  /**
   * Fetches every row whose `field` is one of `values`, unbounded (no
   * pagination) -- a thin wrapper over Postgrest's `.in()` filter for the
   * common "give me all rows for this set of parent ids" lookup. `values`
   * empty returns an empty result without a network call (an `.in()` filter
   * with an empty array is a Postgrest edge case not worth relying on).
   */
  async findWhereIn(field: string, values: string[]) {
    if (values.length === 0) {
      return { result: [] as T[], count: 0, searchParams: '' };
    }
    const { data, count, error } = await this.table
      .select('*', { count: 'exact' })
      .in(field, values);
    if (error) throw new Error(error.message);
    return { result: (data ?? []) as T[], count: count ?? 0, searchParams: '' };
  }
  async reset(records: R[]) {
    await deleteAll(
      this.table,
      this.options.delete_update?.idField,
    );
    return await this.table.insert(records as any[]);
  }
  /**
   * Scoped variant of `reset()`: replaces only the rows whose `field` is one
   * of `scopeValues` (e.g. a filtered subset of parent ids), leaving rows
   * outside that scope untouched. Use this instead of `reset()` whenever the
   * caller has narrowed the operation to a subset rather than the whole
   * table -- `reset()` would otherwise wipe out-of-scope rows too.
   */
  async replaceWhereIn(
    field: string,
    scopeValues: string[],
    records: R[],
  ): Promise<{ error: unknown }> {
    await deleteWhereIn(this.table, field, scopeValues);
    if (records.length === 0) {
      return { error: null };
    }
    return await this.table.insert(records as any[]);
  }
}
