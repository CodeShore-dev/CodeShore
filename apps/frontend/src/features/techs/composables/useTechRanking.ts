import { ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { fetchMvKeywordGroupRanking } from '../../home/service';

export type RankingMode =
  | 'popular'
  | 'salary-year'
  | 'salary-month';

/**
 * Full "技術排行" page data source. Unlike the home teaser
 * (composables/useKeywordTechRanking), this paginates over the whole
 * mv_keyword_group_ranking view and exposes the total `count` so the
 * page can render page numbers.
 */
export function useTechRanking() {
  const loading = ref(false);
  const items = ref<SupabaseView.MvKeywordGroupRanking[]>(
    [],
  );
  const totalCount = ref(0);

  async function fetchPage(opts: {
    mode: RankingMode;
    category: string;
    page: number;
    pageSize: number;
    /** Required for salary modes: the median benchmark to filter by. */
    salaryMedian?: number;
  }) {
    loading.value = true;
    const {
      mode,
      category,
      page,
      pageSize,
      salaryMedian = 0,
    } = opts;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const where: Record<string, unknown> = {
      category: { eq: category },
      job_count: { gte: 8 },
    };
    let orders = 'job_count:desc';

    if (mode !== 'popular') {
      const type =
        mode === 'salary-year' ? 'year' : 'month';
      // Mirror the home high-salary filter shape exactly.
      where.$or = {
        [`${type}_median_avg`]: { gte: salaryMedian },
      };
      orders = `${type}_median_avg:desc`;
    }

    try {
      const { result, count } =
        await fetchMvKeywordGroupRanking({
          from,
          to,
          where: JSON.stringify(where),
          orders,
        });
      items.value = result;
      totalCount.value = count ?? 0;
    } finally {
      loading.value = false;
    }
  }

  return { loading, items, totalCount, fetchPage };
}
