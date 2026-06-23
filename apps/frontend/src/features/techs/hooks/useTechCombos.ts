import { useCallback, useState } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import {
  fetchMvTechRanking,
  fetchMvTechComboStats,
} from '../../home/service';

// Full "技術組合" page data source (task 5.3): language chips + paginated
// co-occurrence combos. React port of the Vue composable.
export function useTechCombos() {
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [languages, setLanguages] = useState<
    SupabaseView.MvTechRanking[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SupabaseView.MvTechComboStats[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const loadLanguages = useCallback(async () => {
    setLoadingLanguages(true);
    try {
      const { result } = await fetchMvTechRanking({
        from: 0,
        to: 19,
        where: JSON.stringify({
          category: { eq: 'language' },
          job_count: { gte: 8 },
        }),
        orders: 'job_count:desc',
      });
      setLanguages(result);
    } finally {
      setLoadingLanguages(false);
    }
  }, []);

  const fetchPage = useCallback(
    async (opts: { tech: string; page: number; pageSize: number }) => {
      setLoading(true);
      const { tech, page, pageSize } = opts;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      try {
        const { result, count } = await fetchMvTechComboStats({
          from,
          to,
          where: JSON.stringify({
            tech1: { eq: tech },
            cat2: { neq: 'language' },
          }),
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

  return {
    loadingLanguages,
    languages,
    loadLanguages,
    loading,
    items,
    totalCount,
    fetchPage,
  };
}
