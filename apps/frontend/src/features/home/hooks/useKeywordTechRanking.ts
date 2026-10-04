import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchMvTechRanking } from '../service';

const DEFAULT_CATEGORY = 'language';

// Home ranking server-state (TanStack Query). The selected category lives
// here, not in the card list, so the query key carries it and every
// category keeps its own cache entry.
export function useKeywordTechRanking(options?: { where?: object; orders?: string; enabled?: boolean }) {
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORY);
  const where = options?.where ?? {};
  const orders = options?.orders ?? 'job_count:desc';

  const query = useQuery({
    queryKey: ['home', 'techRanking', { category: selectedCategory, where, orders }],
    queryFn: async () => {
      const { result } = await fetchMvTechRanking({
        from: 0,
        to: 9,
        where: JSON.stringify({
          category: { eq: selectedCategory },
          job_count: { gte: 8 },
          ...where,
        }),
        orders,
      });
      return result;
    },
    enabled: options?.enabled ?? true,
  });

  return {
    items: query.data ?? [],
    loading: query.isLoading,
    selectedCategory,
    setSelectedCategory,
  };
}
