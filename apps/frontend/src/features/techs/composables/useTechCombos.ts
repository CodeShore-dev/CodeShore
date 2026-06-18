import { ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import {
  fetchMvKeywordGroupRanking,
  fetchMvTechComboStats,
} from '../../home/service';

/**
 * Full "技術組合" page data source. Loads the language chips and the
 * paginated co-occurrence combos for the selected language, exposing the
 * total `count` for page numbers.
 */
export function useTechCombos() {
  const loadingLanguages = ref(false);
  const languages = ref<
    SupabaseView.MvKeywordGroupRanking[]
  >([]);

  const loading = ref(false);
  const items = ref<SupabaseView.MvTechComboStats[]>([]);
  const totalCount = ref(0);

  async function loadLanguages() {
    loadingLanguages.value = true;
    try {
      const { result } = await fetchMvKeywordGroupRanking({
        from: 0,
        to: 19,
        where: JSON.stringify({
          category: { eq: 'language' },
          job_count: { gte: 8 },
        }),
        orders: 'job_count:desc',
      });
      languages.value = result;
    } finally {
      loadingLanguages.value = false;
    }
  }

  async function fetchPage(opts: {
    tech: string;
    page: number;
    pageSize: number;
  }) {
    loading.value = true;
    const { tech, page, pageSize } = opts;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      const { result, count } = await fetchMvTechComboStats(
        {
          from,
          to,
          where: JSON.stringify({
            tech1: { eq: tech },
            cat2: { neq: 'language' },
          }),
          orders: 'job_count:desc',
        },
      );
      items.value = result;
      totalCount.value = count ?? 0;
    } finally {
      loading.value = false;
    }
  }

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
