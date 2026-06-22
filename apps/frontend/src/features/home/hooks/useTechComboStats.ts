import { useCallback, useState } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { fetchMvTechComboStats } from '../service';

// React port of the Vue useTechComboStats composable (task 5.1).
export function useTechComboStats(defaultOptions?: {
  where?: object;
  orders?: string;
}) {
  const orders = defaultOptions?.orders ?? 'job_count:desc';
  const defaultWhereKey = JSON.stringify(defaultOptions?.where ?? {});

  const [items, setItems] = useState<
    SupabaseView.MvTechComboStats[]
  >([]);
  const [loading, setLoading] = useState(false);

  const getItems = useCallback(
    async (options: { where?: object; orders?: string } = {}) => {
      setLoading(true);
      try {
        const { result } = await fetchMvTechComboStats({
          from: 0,
          to: 4,
          where: JSON.stringify({
            ...JSON.parse(defaultWhereKey),
            ...options.where,
          }),
          orders,
        });
        setItems(result);
      } finally {
        setLoading(false);
      }
    },
    [defaultWhereKey, orders],
  );

  return { items, loading, getItems };
}
