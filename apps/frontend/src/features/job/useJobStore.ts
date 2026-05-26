import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { formatNumber } from '../../utils/format';
import { useHomeStore } from '../home/useHomeStore';
import { useKeywordStore } from '../keyword/useKeywordStore';
import {
  createCrawlEventSource,
  fetchJobPreferencedCount,
  fetchJobs,
  setJobPreference,
} from './service';

export const useJobStore = defineStore('job', () => {
  const keywordStore = useKeywordStore();
  const homeStore = useHomeStore();

  const initialized = ref(false);

  const jobs = ref<SupabaseView.JobView[]>([]);
  const listJobs = ref<SupabaseView.JobView[]>([]);
  const listViewPreference = ref<'like' | 'dislike' | null>(
    null,
  );
  const listPage = ref(1);
  const listPageSize = 10;
  const listTotalCount = ref(0);
  const count = {
    total: ref(0),
    liked: ref(0),
    disliked: ref(0),
  };
  const countText = computed(() => ({
    total: formatNumber(
      homeStore.jobCount.jobs -
        count.liked.value -
        count.disliked.value,
    ),
    liked: formatNumber(count.liked.value),
    disliked: formatNumber(count.disliked.value),
  }));
  const countLoaded = ref(false);
  const loading = ref(false);
  const salaryFilter = ref<'none' | 'excluding' | 'only'>(
    'none',
  );
  const salaryAmountFilter = ref<{
    type: 'month' | 'year' | '';
    amount: number | null;
  }>({ type: '', amount: null });
  const searchText = ref<string>('');
  const companySearchText = ref<string>('');

  const baseFilters = computed(() => {
    const where: Record<string, any> = {};

    if (searchText.value.trim()) {
      where.title = {
        ilike: `%${searchText.value.trim()}%`,
      };
    }

    if (companySearchText.value.trim()) {
      where.company_name = {
        ilike: `%${companySearchText.value.trim()}%`,
      };
    }

    const hasInclude = keywordStore.selectedTags.length > 0;
    const hasExclude = keywordStore.excludedTags.length > 0;

    if (hasInclude || hasExclude) {
      const conditions: Record<string, string> = {};
      if (hasInclude) {
        const op =
          keywordStore.keywordOperator === 'or'
            ? 'ov'
            : 'cs';
        conditions[op] =
          `{${keywordStore.selectedTags.join(',')}}`;
      }
      if (hasExclude) {
        conditions['not.ov'] =
          `{${keywordStore.excludedTags.join(',')}}`;
      }
      where.keyword_groups = conditions;
    }

    const hasSalaryWhere = [
      'and(min_salary.neq.0,max_salary.eq.9999999)',
      'and(min_salary.eq.0,max_salary.neq.9999999)',
      'and(min_salary.neq.0,max_salary.neq.9999999)',
    ].join(', ');
    if (salaryFilter.value === 'excluding') {
      where.$or = hasSalaryWhere;
    } else if (salaryFilter.value === 'only') {
      where.$or =
        'and(min_salary.eq.0,max_salary.eq.9999999)';
    }

    if (salaryAmountFilter.value.type) {
      where.salary_type = {
        eq: salaryAmountFilter.value.type,
      };
    }
    if (salaryAmountFilter.value.amount !== null) {
      where.max_salary = {
        gte: salaryAmountFilter.value.amount,
      };
    }

    return where;
  });

  const fetchListJobs = async ({
    preference = null,
    page = 1,
    loadingEffect = false,
  }: {
    preference?: 'like' | 'dislike' | null;
    page?: number;
    loadingEffect?: boolean;
  }) => {
    try {
      loading.value = loadingEffect;
      listViewPreference.value = preference;
      listPage.value = page;
      const from = (page - 1) * listPageSize;
      const to = from + listPageSize - 1;
      const where = preference
        ? {
            preference: { eq: preference },
            ...baseFilters.value,
          }
        : {
            preference: { is: null },
            ...baseFilters.value,
          };

      const [{ result, count: total }, preferencedCount] =
        await Promise.all([
          fetchJobs({
            from,
            to,
            where: JSON.stringify(where),
          }),
          countLoaded.value
            ? Promise.resolve(null)
            : fetchJobPreferencedCount(),
        ]);

      listJobs.value = result;
      listTotalCount.value = total;
      if (preferencedCount !== null) {
        const {
          liked_count: likedCount,
          disliked_count: dislikedCount,
        } = preferencedCount;
        count.liked.value = likedCount;
        count.disliked.value = dislikedCount;
        countLoaded.value = true;
      }
    } catch {
    } finally {
      loading.value = false;
    }
  };

  const updateListJobPreference = async (
    id: string,
    preference: 'like' | 'dislike',
  ) => {
    try {
      loading.value = true;
      await setJobPreference(id, preference);
      const pref = listViewPreference.value!;
      const page = listPage.value;
      const from = (page - 1) * listPageSize;
      const to = from + listPageSize - 1;
      const [
        listData,
        {
          liked_count: likedCount,
          disliked_count: dislikedCount,
        },
      ] = await Promise.all([
        fetchJobs({
          from,
          to,
          where: JSON.stringify({
            preference:
              pref === null ? { is: pref } : { eq: pref },
            ...baseFilters.value,
          }),
        }),
        fetchJobPreferencedCount(),
      ]);
      count.total.value =
        homeStore.jobCount.jobs -
        likedCount -
        dislikedCount;
      count.liked.value = likedCount;
      count.disliked.value = dislikedCount;
      listJobs.value = listData.result;
      listTotalCount.value = listData.count;
    } catch (error) {
      console.error(error);
    } finally {
      loading.value = false;
    }
  };

  const exitListView = async () => {
    listViewPreference.value = null;
    listPage.value = 1;
    listTotalCount.value = 0;
    await fetchListJobs({
      preference: null,
      loadingEffect: true,
    });
  };

  const crawlJobId = ref<string | null>(null);
  const crawlProgress = ref<string[]>([]);
  const crawlDone = ref(false);

  const clickToCrawlJob = (id: string) => {
    crawlJobId.value = id;
    crawlProgress.value = [];
    crawlDone.value = false;

    const es = createCrawlEventSource(id);

    es.onmessage = event => {
      try {
        const { data } = JSON.parse(event.data) ?? {};
        if (data.type === 'log') {
          crawlProgress.value.push(data.message);
        } else if (
          data.type === 'done' ||
          data.type === 'error'
        ) {
          crawlDone.value = true;
          es.close();
          if (data.success) {
            fetchListJobs({
              preference: listViewPreference.value,
              page: 1,
            });
          }
        }
      } catch (error) {
        console.error(error);
      }
    };

    es.onerror = () => {
      crawlDone.value = true;
      es.close();
    };
  };

  watch(
    baseFilters,
    async () => {
      if (!initialized.value) return;
      fetchListJobs({
        preference: listViewPreference.value,
        page: 1,
        loadingEffect: true,
      });
    },
    { deep: true },
  );

  return {
    jobs,
    listJobs,
    listViewPreference,
    listPage,
    listPageSize,
    listTotalCount,
    listTotalCountText: computed(() =>
      formatNumber(listTotalCount.value),
    ),
    count,
    countText,
    loading,
    salaryFilter,
    salaryAmountFilter,
    searchText,
    companySearchText,
    crawlJobId,
    crawlProgress,
    crawlDone,
    initialized,
    clickToCrawlJob,
    fetchListJobs,
    updateListJobPreference,
    exitListView,
  };
});
