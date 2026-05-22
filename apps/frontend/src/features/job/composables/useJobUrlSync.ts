import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useJobStore } from '../useJobStore';

export function useJobUrlSync() {
  const store = useJobStore();
  const keywordStore = useKeywordStore();
  const route = useRoute();
  const router = useRouter();

  const salaryMultiplier = computed(() => {
    if (store.salaryAmountFilter.type === 'year') return 1_000_000;
    if (store.salaryAmountFilter.type === 'month') return 10_000;
    return 1;
  });

  const q = route.query;

  const initialTab =
    q.tab === 'like'
      ? ('like' as const)
      : q.tab === 'dislike'
        ? ('dislike' as const)
        : null;
  const initialPage =
    typeof q.page === 'string' ? Number(q.page) || 1 : 1;
  const selectedJobId = ref<string | null>(
    typeof q.jobId === 'string' && q.jobId ? q.jobId : null,
  );

  store.initialized = false;
  if (typeof q.tags === 'string' && q.tags)
    keywordStore.selectedTags = q.tags.split(',');
  if (typeof q.notTags === 'string' && q.notTags)
    keywordStore.excludedTags = q.notTags.split(',');
  if (q.op === 'or') keywordStore.keywordOperator = 'or';
  if (q.salary === 'excluding' || q.salary === 'only')
    store.salaryFilter = q.salary;
  if (q.salaryType === 'month' || q.salaryType === 'year')
    store.salaryAmountFilter.type = q.salaryType;
  if (typeof q.search === 'string' && q.search)
    store.searchText = q.search;
  if (typeof q.company === 'string' && q.company)
    store.companySearchText = q.company;
  if (typeof q.salaryAmt === 'string' && q.salaryAmt) {
    const n = Number(q.salaryAmt);
    if (!isNaN(n))
      store.salaryAmountFilter.amount = n * salaryMultiplier.value;
  }

  store.fetchListJobs({ preference: initialTab, page: initialPage, loadingEffect: true });
  nextTick(() => { store.initialized = true; });

  keywordStore.getKeywordGroupView();
  keywordStore.getKeywordGroupCategories();

  const rawSalaryAmount = computed(() =>
    store.salaryAmountFilter.amount !== null && salaryMultiplier.value
      ? store.salaryAmountFilter.amount / salaryMultiplier.value
      : null,
  );

  watch(
    () => ({
      tags: keywordStore.selectedTags.slice(),
      notTags: keywordStore.excludedTags.slice(),
      op: keywordStore.keywordOperator,
      salary: store.salaryFilter,
      salaryType: store.salaryAmountFilter.type,
      salaryAmt: rawSalaryAmount.value,
      search: store.searchText,
      company: store.companySearchText,
      tab: store.listViewPreference,
      page: store.listPage,
      jobId: selectedJobId.value,
    }),
    state => {
      const query: Record<string, string> = {};
      if (state.tags.length) query.tags = state.tags.join(',');
      if (state.notTags.length) query.notTags = state.notTags.join(',');
      if (state.op !== 'and') query.op = state.op;
      if (state.salary !== 'none') query.salary = state.salary;
      if (state.salaryType) query.salaryType = state.salaryType;
      if (state.salaryAmt !== null) query.salaryAmt = String(state.salaryAmt);
      if (state.search) query.search = state.search;
      if (state.company) query.company = state.company;
      if (state.tab) query.tab = state.tab;
      if (state.page > 1) query.page = String(state.page);
      if (state.jobId) query.jobId = state.jobId;
      router.push({ query });
    },
  );

  return { selectedJobId };
}
