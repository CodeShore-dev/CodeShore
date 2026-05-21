<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useHomeStore } from '../../home/useHomeStore';
import { useKeywordStore } from '../../keyword/useKeywordStore';
import JobFilterSidebar from '../components/JobFilterSidebar.vue';
import JobList from '../components/JobList.vue';
import { useJobStore } from '../useJobStore';

const store = useJobStore();
const keywordStore = useKeywordStore();
const route = useRoute();
const router = useRouter();

const homeStore = useHomeStore();

homeStore.getJobCount();

const isSidebarOpen = ref(false);
const sidebarRef =
  ref<InstanceType<typeof JobFilterSidebar>>();

const salaryMultiplier = computed(() => {
  if (store.salaryAmountFilter.type === 'year')
    return 1_000_000;
  if (store.salaryAmountFilter.type === 'month')
    return 10_000;
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
    store.salaryAmountFilter.amount =
      n * salaryMultiplier.value;
}

store.fetchListJobs({
  preference: initialTab,
  page: initialPage,
  loadingEffect: true,
});
nextTick(() => {
  store.initialized = true;
});

keywordStore.getKeywordGroupView();
keywordStore.getKeywordGroupCategories();

const rawSalaryAmount = computed(() =>
  store.salaryAmountFilter.amount !== null &&
  salaryMultiplier.value
    ? store.salaryAmountFilter.amount /
      salaryMultiplier.value
    : null,
);

const hasActiveFilters = computed(
  () =>
    keywordStore.selectedTags.length > 0 ||
    keywordStore.excludedTags.length > 0 ||
    keywordStore.keywordOperator !== 'and' ||
    store.salaryFilter !== 'none' ||
    store.salaryAmountFilter.type !== '' ||
    store.salaryAmountFilter.amount !== null ||
    !!store.searchText ||
    !!store.companySearchText,
);

function clearAllFilters(): void {
  keywordStore.selectedTags = [];
  keywordStore.excludedTags = [];
  keywordStore.keywordOperator = 'and';
  keywordStore.keywordSearch = '';
  keywordStore.selectedTab =
    keywordStore.tabs[0]?.value ?? '';
  store.salaryFilter = 'none';
  store.salaryAmountFilter.type = '';
  store.salaryAmountFilter.amount = null;
  store.searchText = '';
  store.companySearchText = '';
  if (sidebarRef.value) {
    sidebarRef.value.localSearchText = '';
    sidebarRef.value.localCompanySearchText = '';
    sidebarRef.value.localSalaryAmount = null;
  }
}

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
    if (state.tags.length)
      query.tags = state.tags.join(',');
    if (state.notTags.length)
      query.notTags = state.notTags.join(',');
    if (state.op !== 'and') query.op = state.op;
    if (state.salary !== 'none')
      query.salary = state.salary;
    if (state.salaryType)
      query.salaryType = state.salaryType;
    if (state.salaryAmt !== null)
      query.salaryAmt = String(state.salaryAmt);
    if (state.search) query.search = state.search;
    if (state.company) query.company = state.company;
    if (state.tab) query.tab = state.tab;
    if (state.page > 1) query.page = String(state.page);
    if (state.jobId) query.jobId = state.jobId;
    router.push({ query });
  },
  { deep: true },
);
</script>

<template>
  <div class="flex w-full flex-1 gap-4 overflow-hidden">
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
      @click="isSidebarOpen = false"
    />

    <aside
      :class="[
        'bg-surface-container-low z-51 flex max-h-screen min-w-70 flex-col space-y-8 overflow-y-auto rounded-xl px-6 py-8 transition-transform duration-300 lg:z-40 lg:max-h-full',
        isSidebarOpen
          ? 'fixed inset-y-0 left-0 h-full w-80 translate-x-0 shadow-2xl'
          : 'fixed inset-y-0 left-0 h-full w-80 -translate-x-full border-r-0 lg:static lg:flex lg:h-auto lg:w-72 lg:translate-x-0',
      ]"
    >
      <div>
        <div
          class="mb-4 flex items-center justify-between lg:hidden"
        >
          <h3
            class="text-on-surface-variant text-sm font-bold tracking-wider "
          >
            篩選條件
          </h3>
          <div class="flex items-center gap-3">
            <button
              v-if="hasActiveFilters"
              class="text-primary cursor-pointer text-sm font-bold"
              @click="clearAllFilters"
            >
              清除篩選
            </button>
            <button
              class="text-on-surface-variant hover:text-on-surface cursor-pointer"
              @click="isSidebarOpen = false"
            >
              <span class="material-symbols-outlined"
                >close</span
              >
            </button>
          </div>
        </div>
        <div
          class="mb-2 hidden items-center justify-between lg:flex"
        >
          <h3
            class="text-on-surface-variant mb-0 text-sm font-bold tracking-wider "
          >
            篩選條件
          </h3>
          <button
            v-if="hasActiveFilters"
            class="text-primary cursor-pointer text-sm font-bold"
            @click="clearAllFilters"
          >
            清除篩選
          </button>
        </div>
        <JobFilterSidebar ref="sidebarRef" />
      </div>
    </aside>

    <div class="w-full overflow-hidden">
      <button
        class="bg-surface-container-low hover:bg-surface-container-high text-on-surface mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl p-4 font-bold shadow-sm transition-all active:scale-[0.98] lg:hidden"
        @click="isSidebarOpen = true"
      >
        <span
          class="material-symbols-outlined"
          data-icon="tune"
          >tune</span
        >
        篩選條件
      </button>
      <section
        class="mb-6 grid w-full max-w-lg grid-cols-3 gap-4"
      >
        <button
          class="rounded-xl p-4 text-center transition-all active:scale-95"
          :class="
            store.listViewPreference === null
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-low hover:bg-surface-container cursor-pointer'
          "
          @click="store.exitListView()"
        >
          <span
            class="mb-1 block text-sm font-bold tracking-widest "
            :class="
              store.listViewPreference === null
                ? 'text-on-primary/70'
                : 'text-secondary'
            "
            >總數</span
          >
          <span class="text-2xl font-black">
            {{
              !store.listViewPreference
                ? store.loading
                  ? store.countText.total
                  : store.listTotalCountText
                : store.countText.total
            }}
            <span
              v-if="!store.listViewPreference"
              class="text-sm whitespace-nowrap"
              >/ {{ store.countText.total }}</span
            >
          </span>
        </button>
        <button
          class="rounded-xl p-4 text-center transition-all active:scale-95"
          :class="
            store.listViewPreference === 'like'
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-low hover:bg-surface-container cursor-pointer'
          "
          @click="
            store.fetchListJobs({
              preference: 'like',
              loadingEffect: true,
            })
          "
        >
          <span
            class="mb-1 block text-sm font-bold tracking-widest "
            :class="
              store.listViewPreference === 'like'
                ? 'text-on-primary/70'
                : 'text-secondary'
            "
            >喜歡</span
          >
          <span class="text-2xl font-black">
            {{
              store.listViewPreference === 'like'
                ? store.loading
                  ? store.countText.liked
                  : store.listTotalCount
                : store.countText.liked
            }}
            <span
              v-if="store.listViewPreference === 'like'"
              class="text-sm whitespace-nowrap"
              >/ {{ store.countText.liked }}</span
            >
          </span>
        </button>
        <button
          class="rounded-xl p-4 text-center transition-all active:scale-95"
          :class="
            store.listViewPreference === 'dislike'
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-low hover:bg-surface-container cursor-pointer'
          "
          @click="
            store.fetchListJobs({
              preference: 'dislike',
              loadingEffect: true,
            })
          "
        >
          <span
            class="mb-1 block text-sm font-bold tracking-widest "
            :class="
              store.listViewPreference === 'dislike'
                ? 'text-on-primary/70'
                : 'text-secondary'
            "
            >不喜歡</span
          >
          <span class="text-2xl font-black">
            {{
              store.listViewPreference === 'dislike'
                ? store.loading
                  ? store.countText.disliked
                  : store.listTotalCount
                : store.countText.disliked
            }}
            <span
              v-if="store.listViewPreference === 'dislike'"
              class="text-sm whitespace-nowrap"
              >/ {{ store.countText.disliked }}</span
            >
          </span>
        </button>
      </section>
      <JobList
        :has-active-filters
        v-model:selected-job-id="selectedJobId"
        @clear-all-filters="clearAllFilters"
      />
    </div>
  </div>
</template>

