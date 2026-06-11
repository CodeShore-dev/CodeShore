import { ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { fetchMvKeywordGroupRanking } from '../service';

export default (options?: {
  where: Object;
  orders: string;
}) => {
  const loading = ref(false);

  const { where = {}, orders = 'job_count:desc' } =
    options ?? {};

  const items = ref<SupabaseView.MvKeywordGroupRanking[]>(
    [],
  );

  const getItems = async (category?: string) => {
    loading.value = true;
    ({ result: items.value } =
      await fetchMvKeywordGroupRanking({
        from: 0,
        to: 9,
        where: JSON.stringify({
          category: { eq: category },
          job_count: { gte: 8 },
          ...where,
        }),
        orders,
      }));
    loading.value = false;
  };

  return {
    items,
    loading,
    getItems,
  };
};
