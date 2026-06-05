import {
  PostgrestError,
  PostgrestFilterBuilder,
  PostgrestQueryBuilder,
} from '@supabase/supabase-js';

import {
  ListQuery,
  ListResponse,
} from '@codeshore/data-types';
import {
  LogExceptionFn,
  LogResponseFn,
  OutboundLogger,
  ServiceLogger,
} from '@codeshore/service-logger';

export type LoggerOptions = {
  logger?: ServiceLogger;
  name?: string;
  caller?: string;
};

export async function fetchListRPC<T>(
  builder: PostgrestFilterBuilder<
    any,
    any,
    any,
    any,
    'get_jobs_by_preference',
    null,
    string
  >,
  query: ListQuery,
  loggerOptions?: LoggerOptions,
): Promise<ListResponse<T>> {
  return _fetchList(builder, query, loggerOptions);
}

export async function fetchList<T>(
  builder: PostgrestQueryBuilder<
    any,
    any,
    any,
    string,
    unknown
  >,
  query: ListQuery,
  options?: {
    head?: boolean;
    count?:
      | 'exact'
      | 'planned'
      | 'estimated'
      | (string & {});
  },
  loggerOptions?: LoggerOptions,
): Promise<ListResponse<T>> {
  return _fetchList(
    builder.select(
      query.select ?? '*',
      options ?? {
        count: 'exact',
      },
    ),
    query,
    loggerOptions,
  );
}

export async function deleteAll(
  builder: PostgrestQueryBuilder<
    any,
    any,
    any,
    string,
    unknown
  >,
  idField = 'id',
) {
  return builder.delete().neq(idField, '');
}

export const distinct = <T>(
  source: T[],
  predicate: (x: T, y: T) => boolean,
) =>
  source.filter(
    (x: T, i: number, arr: T[]) =>
      arr.findIndex(y => predicate(x, y)) === i,
  );

async function _fetchList<T>(
  builder: PostgrestFilterBuilder<
    any,
    any,
    any,
    any,
    string,
    null,
    string
  >,
  query: ListQuery,
  loggerOptions?: LoggerOptions,
): Promise<ListResponse<T>> {
  const { where, orders = [], from = 0, to = 0 } = query;

  if (where) {
    for (const [column, conditions] of Object.entries(
      where,
    )) {
      if (column === '$or') {
        const ors = Array.isArray(conditions)
          ? conditions
          : [conditions];
        for (const or of ors) {
          if (typeof or === 'string')
            builder = builder.or(or);
        }
      } else if (
        column === '$and' &&
        typeof conditions === 'string'
      ) {
        builder = builder.filter(
          '',
          'and',
          `(${conditions})`,
        );
      } else if (
        typeof conditions === 'object' &&
        conditions !== null
      ) {
        for (const [operator, value] of Object.entries(
          conditions,
        )) {
          builder = builder.filter(column, operator, value);
        }
      }
    }
  }

  for (const order of orders) {
    builder = builder.order(order.column as any, {
      ascending: order.ascending,
    });
  }

  if (from > 0 || to > -1) {
    builder = builder.range(from, to);
  }

  const url = (builder as any).url as URL;
  const searchParams = decodeURIComponent(
    url.searchParams.toString(),
  );

  let logException:
    | LogExceptionFn<PostgrestError>
    | undefined;
  let logResponse: LogResponseFn | undefined;
  if (loggerOptions && loggerOptions.logger) {
    ({ logException, logResponse } = new OutboundLogger(
      loggerOptions.logger,
    ).logRequest<PostgrestError>({
      name: loggerOptions.name,
      caller: loggerOptions.caller,
      url: url.toString(),
    }));
  }
  const { data, count, error, status } = await builder;
  if (error) {
    logException?.(error, false, error => ({
      status: -1,
      data: error.toJSON(),
    }));
  } else {
    logResponse?.({ status, data: `${data.length}` });
  }

  return {
    result: data ?? [],
    count: count ?? 0,
    searchParams,
  };
}
