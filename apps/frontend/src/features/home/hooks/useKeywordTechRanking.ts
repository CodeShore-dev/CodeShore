import { useCallback, useState } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { fetchMvTechRanking } from '../service';

// React port of the Vue useKeywordTechRanking composable (task 5.1).
// Imperative fetch driven by the consuming card list's category selection.
export function useKeywordTechRanking(options?: {
  where?: object;
  orders?: string;
}) {
  const orders = options?.orders ?? 'job_count:desc';
  const whereKey = JSON.stringify(options?.where ?? {});

  const [items, setItems] = useState<
    SupabaseView.MvTechRanking[]
  >([]);
  const [loading, setLoading] = useState(false);

  const getItems = useCallback(
    async (category?: string) => {
      setLoading(true);
      try {
        const { result } = await fetchMvTechRanking({
          from: 0,
          to: 9,
          where: JSON.stringify({
            category: { eq: category },
            job_count: { gte: 8 },
            ...JSON.parse(whereKey),
          }),
          orders,
        });
        setItems(result);
      } finally {
        setLoading(false);
      }
    },
    [whereKey, orders],
  );

  return { items, loading, getItems };
}
