import { ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { fetchMvTechComboStats } from '../service';

export default (defaultOptions?: {
  where?: Object;
  orders?: string;
}) => {
  const loading = ref(false);

  const {
    where: defaultWhere = {},
    orders = 'job_count:desc',
  } = defaultOptions ?? {};

  const items = ref<SupabaseView.MvTechComboStats[]>([]);

  const getItems = async (options: {
    where?: Object;
    orders?: string;
  } = {}) => {
    loading.value = true;
    ({ result: items.value } = await fetchMvTechComboStats({
      from: 0,
      to: 4,
      where: JSON.stringify({
        ...defaultWhere,
        ...options.where,
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
