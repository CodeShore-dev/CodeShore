import { useCallback, useState } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { fetchMvTechComboStats } from '../../home/service';

// Paginated tech-combo table data source. Filters by the parent tech's
// category (cat1) so a single table can list combos across many parent
// techs at once; 'all' omits the cat1 filter entirely.
export function useTechCombos() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SupabaseView.MvTechComboStats[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPage = useCallback(
    async (opts: { category: string; page: number; pageSize: number }) => {
      setLoading(true);
      const { category, page, pageSize } = opts;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const where: Record<string, unknown> = { cat2: { neq: 'language' } };
      if (category !== 'all') {
        where.cat1 = { eq: category };
      }

      try {
        const { result, count } = await fetchMvTechComboStats({
          from,
          to,
          where: JSON.stringify(where),
          orders: 'job_count:desc',
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
