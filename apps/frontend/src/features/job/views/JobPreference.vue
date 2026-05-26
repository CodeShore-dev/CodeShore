<script setup lang="ts">
import { computed, ref } from 'vue';

import { useHomeStore } from '../../home/useHomeStore';
import { useKeywordStore } from '../../keyword/useKeywordStore';
import JobFilterSidebar from '../components/JobFilterSidebar.vue';
import JobList from '../components/JobList.vue';
import { useJobUrlSync } from '../composables/useJobUrlSync';
import { useJobStore } from '../useJobStore';

const store = useJobStore();
const keywordStore = useKeywordStore();

const homeStore = useHomeStore();
homeStore.getJobCount();

const isSidebarOpen = ref(false);
const sidebarRef = ref<InstanceType<typeof JobFilterSidebar>>();

const { selectedJobId } = useJobUrlSync();

const viewTabs = computed(() => [
  {
    label: '總數',
    pref: null as null,
    count: store.countText.total,
    onClick: () => store.exitListView(),
  },
  {
    label: '喜歡',
    pref: 'like' as const,
    count: store.countText.liked,
    onClick: () => store.fetchListJobs({ preference: 'like', loadingEffect: true }),
  },
  {
    label: '不喜歡',
    pref: 'dislike' as const,
    count: store.countText.disliked,
    onClick: () => store.fetchListJobs({ preference: 'dislike', loadingEffect: true }),
  },
]);

const hasActiveFilters = computed(
  () =>
    keywordStore.selectedTags.length > 0 ||
    keywordStore.excludedTags.length > 0 ||
    keywordStore.keywordOperator !== 'and' ||
    store.salaryFilter !== 'none' ||
    store.salaryAmountFilter.type !== '' ||
    store.salaryAmountFilter.amount !== null ||
    !!store.searchText ||
    !!store.companySearchText ||
    store.selectedLocations.length > 0,
);

function clearAllFilters(): void {
  keywordStore.selectedTags = [];
  keywordStore.excludedTags = [];
  keywordStore.keywordOperator = 'and';
  keywordStore.keywordSearch = '';
  keywordStore.selectedTab = keywordStore.tabs[0]?.value ?? '';
  store.salaryFilter = 'none';
  store.salaryAmountFilter.type = '';
  store.salaryAmountFilter.amount = null;
  store.searchText = '';
  store.companySearchText = '';
  store.selectedLocations = [];
  if (sidebarRef.value) {
    sidebarRef.value.localSearchText = '';
    sidebarRef.value.localCompanySearchText = '';
    sidebarRef.value.localSalaryAmount = null;
  }
}
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
        'z-51 flex max-h-screen min-w-70 flex-col space-y-8 overflow-y-auto rounded-xl bg-white px-6 py-8 shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-transform duration-300 lg:z-40 lg:max-h-full',
        isSidebarOpen
          ? 'fixed inset-y-0 left-0 h-full w-80 translate-x-0 shadow-2xl'
          : 'fixed inset-y-0 left-0 h-full w-80 -translate-x-full lg:static lg:flex lg:h-auto lg:w-72 lg:translate-x-0',
      ]"
    >
      <div>
        <div class="mb-4 flex items-center justify-between lg:hidden">
          <h3 class="text-[11px] font-bold tracking-[0.18em] text-[#003d92]">篩選條件</h3>
          <div class="flex items-center gap-3">
            <button
              v-if="hasActiveFilters"
              class="cursor-pointer text-sm font-bold text-[#003d92]"
              @click="clearAllFilters"
            >清除篩選</button>
            <button
              class="cursor-pointer text-[#434653] hover:text-[#001f2a]"
              @click="isSidebarOpen = false"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div class="mb-2 hidden items-center justify-between lg:flex">
          <h3 class="mb-0 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">篩選條件</h3>
          <button
            v-if="hasActiveFilters"
            class="cursor-pointer text-sm font-bold text-[#003d92]"
            @click="clearAllFilters"
          >清除篩選</button>
        </div>
        <JobFilterSidebar ref="sidebarRef" />
      </div>
    </aside>

    <div class="w-full overflow-hidden">
      <button
        class="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white p-4 font-bold text-[#001f2a] shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:bg-[#f4faff] active:scale-[0.98] lg:hidden"
        @click="isSidebarOpen = true"
      >
        <span class="material-symbols-outlined">tune</span>
        篩選條件
        <span
          v-if="hasActiveFilters"
          class="ml-auto rounded-full bg-[#003d92] px-2 py-0.5 text-xs font-bold text-white"
        >已篩選</span>
      </button>

      <!-- Tab selector -->
      <section class="mb-6 grid w-full max-w-lg grid-cols-3 gap-3">
        <button
          v-for="tab in viewTabs"
          :key="tab.pref ?? 'all'"
          class="rounded-xl p-4 text-center transition-all active:scale-95"
          :class="
            store.listViewPreference === tab.pref
              ? 'bg-[#003d92] text-white shadow-md'
              : 'cursor-pointer bg-white text-[#001f2a] shadow-[0_24px_40px_rgba(0,31,42,0.06)] hover:bg-[#f4faff]'
          "
          @click="tab.onClick()"
        >
          <span
            class="mb-1 block text-[10px] font-bold tracking-[0.15em]"
            :class="store.listViewPreference === tab.pref ? 'text-white/60' : 'text-[#434653]'"
          >{{ tab.label }}</span>
          <span class="tabular-nums text-2xl font-black">
            {{ store.listViewPreference === tab.pref && !store.loading ? store.listTotalCountText : tab.count }}
            <span
              v-if="store.listViewPreference === tab.pref"
              class="whitespace-nowrap text-sm"
            >/ {{ tab.count }}</span>
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
