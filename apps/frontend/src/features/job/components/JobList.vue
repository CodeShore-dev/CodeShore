<script lang="ts" setup>
import { useWindowScroll } from '@vueuse/core';
import { computed, nextTick, watch } from 'vue';

import Pagination from '../../../components/Pagination.vue';
import { useJobStore } from '../useJobStore';
import JobDetailDrawer from './JobDetailDrawer.vue';
import JobListItem from './JobListItem.vue';
import JobListSkeleton from './JobListSkeleton.vue';

type Props = { hasActiveFilters: boolean };
const props = withDefaults(defineProps<Props>(), {
  hasActiveFilters: false,
});

type Emits = { (e: 'clearAllFilters'): void };
const emit = defineEmits<Emits>();

const store = useJobStore();

const selectedJobId = defineModel<string | null>('selectedJobId', { default: null });
const selectedJob = computed(() => store.listJobs.find(x => x.id === selectedJobId.value));

const totalPages = computed(() =>
  Math.ceil(store.listTotalCount / store.listPageSize),
);

const selectedJobIndex = computed(() =>
  store.listJobs.findIndex(x => x.id === selectedJobId.value),
);

const isFirstJobOnFirstPage = computed(
  () => selectedJobIndex.value === 0 && store.listPage === 1,
);

const isLastJobOnLastPage = computed(
  () =>
    selectedJobIndex.value === store.listJobs.length - 1 &&
    store.listPage >= totalPages.value,
);

const { y } = useWindowScroll();

const scrollToTop = async () => {
  await nextTick();
  y.value = 0;
};

const goToPage = async (page: number) => {
  if (page < 1 || page > totalPages.value || store.loading) return;
  await store.fetchListJobs({
    preference: store.listViewPreference!,
    page,
    loadingEffect: true,
  });
  await scrollToTop();
};

const goToPrevJob = async () => {
  if (isFirstJobOnFirstPage.value || store.loading) return;
  if (selectedJobIndex.value > 0) {
    selectedJobId.value = store.listJobs[selectedJobIndex.value - 1].id;
  } else {
    await store.fetchListJobs({
      preference: store.listViewPreference!,
      page: store.listPage - 1,
      loadingEffect: true,
    });
    selectedJobId.value = store.listJobs[store.listJobs.length - 1]?.id ?? null;
  }
};

const goToNextJob = async () => {
  if (isLastJobOnLastPage.value || store.loading) return;
  if (selectedJobIndex.value < store.listJobs.length - 1) {
    selectedJobId.value = store.listJobs[selectedJobIndex.value + 1].id;
  } else {
    await store.fetchListJobs({
      preference: store.listViewPreference!,
      page: store.listPage + 1,
      loadingEffect: true,
    });
    selectedJobId.value = store.listJobs[0]?.id ?? null;
  }
};

const updatePreference = async (preference: 'like' | 'dislike') => {
  await store.updateListJobPreference(selectedJob.value!.id, preference);
  selectedJobId.value = store.listJobs[0]?.id ?? null;
};

const listItemElMap = new Map<string, HTMLElement>();

const setListItemRef = (el: unknown, jobId: string) => {
  if (el) {
    listItemElMap.set(jobId, (el as { $el: HTMLElement }).$el);
  } else {
    listItemElMap.delete(jobId);
  }
};

watch(selectedJobId, async newId => {
  await nextTick();
  if (newId) {
    listItemElMap.get(newId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }
});
</script>

<template>
  <div class="overflow-hidden rounded-xl bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
    <JobListSkeleton v-if="store.loading" />

    <div
      v-else-if="store.listJobs.length === 0"
      class="flex flex-col items-center justify-center p-12 text-center"
    >
      <span class="material-symbols-outlined mb-4 text-6xl text-[#001f2a]/20">search_off</span>
      <h2 class="mb-2 text-xl font-black text-[#001f2a]">此篩選條件沒有職缺</h2>
      <p class="mb-6 text-sm text-[#434653]">
        試試切換別的篩選組合或清空篩選條件，以探索更多機會。
      </p>
      <button
        v-if="props.hasActiveFilters"
        class="cursor-pointer rounded-xl bg-[#003d92] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1654b9] active:scale-95"
        @click="emit('clearAllFilters')"
      >
        清空所有篩選
      </button>
    </div>

    <template v-else>
      <ul class="divide-y divide-[#001f2a]/[0.06] pl-0">
        <JobListItem
          v-for="job in store.listJobs"
          :key="job.id"
          :ref="el => setListItemRef(el, job.id)"
          :job="job"
          :selected="selectedJobId === job.id"
          @select="selectedJobId = $event"
        />
      </ul>

      <div
        v-if="totalPages > 1"
        class="border-t border-[#001f2a]/[0.06] px-5 py-3"
      >
        <span class="mb-2 block text-xs font-bold text-[#434653]">
          第 {{ store.listPage }} / {{ totalPages }} 頁・共 {{ store.listTotalCount }} 筆
        </span>
        <Pagination
          :current-page="store.listPage"
          :total-pages="totalPages"
          @update:current-page="goToPage"
        />
      </div>
    </template>
  </div>

  <JobDetailDrawer
    :job="selectedJob"
    :is-first="isFirstJobOnFirstPage"
    :is-last="isLastJobOnLastPage"
    @close="selectedJobId = null"
    @prev="goToPrevJob"
    @next="goToNextJob"
    @update-preference="updatePreference"
  />
</template>
