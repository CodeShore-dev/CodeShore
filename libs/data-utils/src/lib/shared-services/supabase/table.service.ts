import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { ServiceLogger } from '@codeshore/service-logger';

import { BaseService, Options } from './base.service';
import { chunk, deleteAll, deleteWhereIn } from './utils';

// Bulk inserts on tables with FK/PK constraints (e.g. job_tech) can hit
// "canceling statement due to statement timeout" once the record count gets
// into the thousands -- splitting into batches keeps each INSERT statement
// fast regardless of total record count.
const INSERT_BATCH_SIZE = 500;

export class TableService<T extends Record<string, any>, R extends Partial<T> = T> extends BaseService<T> {
  constructor(client: SupabaseClient, tableName: string, logger?: ServiceLogger, options?: Options) {
    super(client, tableName, logger, options);
  }
  upsert(records: R[]) {
    return this.table.upsert(records as any[], this.options.upsert);
  }
  update(record: Partial<R>) {
    const { id, ...values } = record;
    return this.table.update(values as any).eq(this.options.delete_update?.idField || 'id', id);
  }
  updateMultiple(records: Partial<R>[]) {
    return Promise.all(records.map(this.update));
  }
  delete(id: string) {
    return this.table.delete().eq(this.options.delete_update?.idField || 'id', id);
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
    const { data, count, error } = await this.table.select('*', { count: 'exact' }).in(field, values);
    if (error) throw new Error(error.message);
    return { result: (data ?? []) as T[], count: count ?? 0, searchParams: '' };
  }
  async reset(records: R[]) {
    this.logger?.info(`Resetting table ${this.tableName} with ${records.length} records`);
    await deleteAll(this.table, this.options.delete_update?.idField);
    if (records.length === 0) {
      return;
    }
    const { error } = await this._insertInBatches(records);
    if (error) {
      this.logger?.error(`Error inserting records into table ${this.tableName}`, error);
    } else {
      this.logger?.info(`Successfully reset table ${this.tableName} with ${records.length} records`);
    }
  }
  /**
   * Scoped variant of `reset()`: replaces only the rows whose `field` is one
   * of `scopeValues` (e.g. a filtered subset of parent ids), leaving rows
   * outside that scope untouched. Use this instead of `reset()` whenever the
   * caller has narrowed the operation to a subset rather than the whole
   * table -- `reset()` would otherwise wipe out-of-scope rows too.
   */
  async replaceWhereIn(field: string, scopeValues: string[], records: R[]): Promise<{ error: unknown }> {
    await deleteWhereIn(this.table, field, scopeValues);
    if (records.length === 0) {
      return { error: null };
    }
    return await this._insertInBatches(records);
  }
  /**
   * Inserts `records` in batches of `INSERT_BATCH_SIZE` rather than a single
   * statement, so tables with FK/PK constraints (e.g. job_tech) don't hit
   * "canceling statement due to statement timeout" once the record count
   * gets into the thousands. Stops at the first batch that errors.
   */
  private async _insertInBatches(records: R[]): Promise<{ error: PostgrestError | null }> {
    const batches = chunk(records, INSERT_BATCH_SIZE);
    for (const [index, batch] of batches.entries()) {
      this.logger?.info(
        `Inserting batch ${index + 1}/${batches.length} (${batch.length} records) into table ${this.tableName}`,
      );
      const { error } = await this.table.insert(batch as any[]);
      if (error) {
        return { error };
      }
    }
    return { error: null };
  }
}
