<script setup lang="ts">
import { computed, ref } from 'vue';

import { useHomeStore } from '../../home/useHomeStore';
import { useKeywordStore } from '../../keyword/useKeywordStore';
import InfoHint from '../../methodology/components/InfoHint.vue';
import JobActiveFilters from '../components/JobActiveFilters.vue';
import JobFilterSidebar from '../components/JobFilterSidebar.vue';
import JobList from '../components/JobList.vue';
import { useJobUrlSync } from '../composables/useJobUrlSync';
import { useJobStore } from '../useJobStore';

const store = useJobStore();
const keywordStore = useKeywordStore();

const homeStore = useHomeStore();
homeStore.getJobCount();

const isSidebarOpen = ref(false);

const sortOptions = [
  { value: 'salary' as const, label: '薪資' },
  { value: 'recent' as const, label: '最近標記' },
] as const;

const { selectedJobId } = useJobUrlSync();

const viewTabs = computed(() => [
  {
    label: '總數',
    pref: null as null,
    count: store.countText.total,
    onClick: () => store.exitListView(),
    onClear: null,
  },
  {
    label: '喜歡',
    pref: 'like' as const,
    count: store.countText.liked,
    onClick: () =>
      store.fetchListJobs({
        preference: 'like',
        loadingEffect: true,
      }),
    onClear: () => store.clearPreferences('like'),
  },
  {
    label: '不喜歡',
    pref: 'dislike' as const,
    count: store.countText.disliked,
    onClick: () =>
      store.fetchListJobs({
        preference: 'dislike',
        loadingEffect: true,
      }),
    onClear: () => store.clearPreferences('dislike'),
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
  keywordStore.selectedTab =
    keywordStore.tabs[0]?.value ?? '';
  store.salaryFilter = 'none';
  store.salaryAmountFilter.type = '';
  store.salaryAmountFilter.amount = null;
  store.searchText = '';
  store.companySearchText = '';
  store.selectedLocations = [];
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
        <div
          class="mb-4 flex items-center justify-between lg:hidden"
        >
          <h3
            class="text-[11px] font-bold tracking-[0.18em] text-[#003d92]"
          >
            篩選條件
          </h3>
          <div class="flex items-center gap-3">
            <button
              v-if="hasActiveFilters"
              class="cursor-pointer text-sm font-bold text-[#003d92]"
              @click="clearAllFilters"
            >
              清除篩選
            </button>
            <button
              class="cursor-pointer text-[#434653] hover:text-[#001f2a]"
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
            class="mb-0 text-[11px] font-bold tracking-[0.18em] text-[#003d92]"
          >
            篩選條件
          </h3>
          <button
            v-if="hasActiveFilters"
            class="cursor-pointer text-sm font-bold text-[#003d92]"
            @click="clearAllFilters"
          >
            清除篩選
          </button>
        </div>
        <JobFilterSidebar />
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
          >已篩選</span
        >
      </button>

      <!-- Tab selector -->
      <div
        class="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-[#003d92]"
      >
        職缺統計
        <InfoHint metric="job.list" />
      </div>
      <section
        class="mb-6 grid w-full max-w-lg grid-cols-3 gap-3"
      >
        <div
          v-for="tab in viewTabs"
          :key="tab.pref ?? 'all'"
          class="relative rounded-xl transition-all"
          :class="
            store.listViewPreference === tab.pref
              ? 'bg-[#003d92] text-white shadow-md'
              : 'bg-white text-[#001f2a] shadow-[0_24px_40px_rgba(0,31,42,0.06)]'
          "
        >
          <button
            class="h-full w-full p-4 text-center active:scale-95"
            :class="
              store.listViewPreference !== tab.pref
                ? 'cursor-pointer rounded-xl hover:bg-[#f4faff]'
                : ''
            "
            @click="tab.onClick()"
          >
            <span
              class="mb-1 block text-[10px] font-bold tracking-[0.15em]"
              :class="
                store.listViewPreference === tab.pref
                  ? 'text-white/60'
                  : 'text-[#434653]'
              "
              >{{ tab.label }}</span
            >
            <span class="text-2xl font-black tabular-nums">
              {{
                store.listViewPreference === tab.pref &&
                !store.loading
                  ? store.listTotalCountText
                  : tab.count
              }}
              <span
                v-if="store.listViewPreference === tab.pref"
                class="text-sm whitespace-nowrap"
                >/ {{ tab.count }}</span
              >
            </span>
          </button>
          <button
            v-if="tab.onClear && tab.count !== '0'"
            class="absolute top-1.5 right-1.5 flex size-6 cursor-pointer items-center justify-center rounded-lg transition-colors"
            :class="
              store.listViewPreference === tab.pref
                ? 'text-white/50 hover:bg-white/20 hover:text-white'
                : 'text-[#999] hover:bg-[#fee2e2] hover:text-[#dc2626]'
            "
            :title="`清空${tab.label}`"
            @click.stop="tab.onClear()"
          >
            <span
              class="material-symbols-outlined text-base leading-none"
              >delete</span
            >
          </button>
        </div>
      </section>

      <JobActiveFilters @clear-all="clearAllFilters" />

      <!-- Sort selector: only meaningful for liked / disliked lists -->
      <div
        v-if="store.listViewPreference"
        class="mb-4 flex items-center justify-end gap-2"
      >
        <span class="text-xs font-bold text-[#434653]"
          >排序</span
        >
        <div
          class="inline-flex rounded-xl bg-white p-1 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
        >
          <button
            v-for="option in sortOptions"
            :key="option.value"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
            :class="
              store.listSort === option.value
                ? 'bg-[#003d92] text-white shadow-md'
                : 'text-[#001f2a] hover:bg-[#f4faff]'
            "
            @click="store.setListSort(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <JobList
        :has-active-filters
        v-model:selected-job-id="selectedJobId"
        @clear-all-filters="clearAllFilters"
      />
    </div>
  </div>
</template>
