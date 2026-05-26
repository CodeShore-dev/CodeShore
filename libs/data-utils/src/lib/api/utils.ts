import { ListQuery, ListResponse } from '@codeshore/data-types';

export async function fetchList<T>(
  builder: any,
  query: ListQuery,
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
          if (typeof or === 'string') builder = builder.or(or);
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

  const { data, count } = await builder;

  return {
    result: data ?? [],
    count: count ?? 0,
    query: decodeURIComponent(
      builder.url.searchParams.toString(),
    ),
  };
}

