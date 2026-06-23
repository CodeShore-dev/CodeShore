import { useCallback, useState } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { fetchMvKeywordGroupRanking } from '../../home/service';

export type RankingMode = 'popular' | 'salary-year' | 'salary-month';

// Full "技術排行" page data source (task 5.3). Paginates the whole ranking
// view and exposes total count for page numbers. React port of the Vue
// composable.
export function useTechRanking() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<
    SupabaseView.MvKeywordGroupRanking[]
  >([]);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPage = useCallback(
    async (opts: {
      mode: RankingMode;
      category: string;
      page: number;
      pageSize: number;
      salaryMedian?: number;
    }) => {
      setLoading(true);
      const { mode, category, page, pageSize, salaryMedian = 0 } = opts;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const where: Record<string, unknown> = {
        category: { eq: category },
        job_count: { gte: 8 },
      };
      let orders = 'job_count:desc';
      if (mode !== 'popular') {
        const type = mode === 'salary-year' ? 'year' : 'month';
        where.$or = { [`${type}_median_avg`]: { gte: salaryMedian } };
        orders = `${type}_median_avg:desc`;
      }

      try {
        const { result, count } = await fetchMvKeywordGroupRanking({
          from,
          to,
          where: JSON.stringify(where),
          orders,
        });
        setItems(result);
        setTotalCount(count ?? 0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, items, totalCount, fetchPage };
}
