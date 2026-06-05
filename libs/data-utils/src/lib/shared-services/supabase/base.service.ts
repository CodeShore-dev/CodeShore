import {
  PostgrestQueryBuilder,
  SupabaseClient,
} from '@supabase/supabase-js';

import { ListQuery } from '@codeshore/data-types';
import { ServiceLogger } from '@codeshore/service-logger';

import { fetchList } from './utils';

export type Options = {
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

export class BaseService<T extends Record<string, any>> {
  readonly logger?: ServiceLogger;
  readonly tableName: string;
  readonly client: SupabaseClient;
  readonly table: PostgrestQueryBuilder<
    any,
    any,
    any,
    string,
    unknown
  >;
  readonly options: Options;
  constructor(
    client: SupabaseClient,
    tableName: string,
    logger?: ServiceLogger,
    options?: Options,
  ) {
    this.logger = logger;
    this.client = client;
    this.tableName = tableName;
    this.table = client.from(tableName);
    this.options = options ?? {};
  }
  /**
   * @param query.where - filter conditions, e.g. { id: 1 } or { name: 'John' }
   * @param query.orders - sorting conditions, e.g. [{ column: 'created_at', ascending: false }]
   * @param query.select - columns to select, e.g. 'id, name, created_at', default is '*'
   * @returns a list of records matching the query conditions
   */
  fetchAll(query?: Omit<ListQuery, 'from' | 'to'>) {
    return this.fetch({
      from: 0,
      to: -1,
      ...query,
    });
  }
  /**
   * @param query.where - filter conditions, e.g. { id: 1 } or { name: 'John' }
   * @param query.orders - sorting conditions, e.g. [{ column: 'created_at', ascending: false }]
   * @param query.select - columns to select, e.g. 'id, name, created_at', default is '*'
   * @param query.from - pagination start index
   * @param query.to - pagination end index
   * @returns a list of records matching the query conditions
   */
  fetch(query: ListQuery) {
    return fetchList<T>(
      this.table,
      query,
      this.options.select,
      { logger: this.logger, name: this.tableName },
    );
  }
}
