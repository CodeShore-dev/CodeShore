<script lang="ts" setup>
import { useWindowScroll } from '@vueuse/core';
import { computed, nextTick, ref, watch } from 'vue';

import Pagination from '../../../components/Pagination.vue';
import { useJobStore } from '../useJobStore';
import JobCard from './JobCard.vue';
import JobListItem from './JobListItem.vue';

type Props = { hasActiveFilters: boolean };
const props = withDefaults(defineProps<Props>(), {
  hasActiveFilters: false,
});

type Emits = { (e: 'clearAllFilters'): void };
const emit = defineEmits<Emits>();

const store = useJobStore();

const selectedJobId = defineModel<string | null>(
  'selectedJobId',
  { default: null },
);
const selectedJob = computed(
  () =>
    store.listJobs.find(x => x.id === selectedJobId.value)!,
);

const totalPages = computed(() =>
  Math.ceil(store.listTotalCount / store.listPageSize),
);

const selectedJobIndex = computed(() =>
  store.listJobs.findIndex(
    x => x.id === selectedJobId.value,
  ),
);

const isFirstJobOnFirstPage = computed(
  () =>
    selectedJobIndex.value === 0 && store.listPage === 1,
);

const isLastJobOnLastPage = computed(
  () =>
    selectedJobIndex.value === store.listJobs.length - 1 &&
    store.listPage >= totalPages.value,
);

const { y } = useWindowScroll();

const scrollToTop = async () => {
  await nextTick(() => {});
  y.value = 0;
};

const goToPage = async (page: number) => {
  if (page < 1 || page > totalPages.value || store.loading)
    return;
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
    selectedJobId.value =
      store.listJobs[selectedJobIndex.value - 1].id;
  } else {
    await store.fetchListJobs({
      preference: store.listViewPreference!,
      page: store.listPage - 1,
      loadingEffect: true,
    });
    selectedJobId.value =
      store.listJobs[store.listJobs.length - 1]?.id ?? null;
  }
};

const goToNextJob = async () => {
  if (isLastJobOnLastPage.value || store.loading) return;
  if (selectedJobIndex.value < store.listJobs.length - 1) {
    selectedJobId.value =
      store.listJobs[selectedJobIndex.value + 1].id;
  } else {
    await store.fetchListJobs({
      preference: store.listViewPreference!,
      page: store.listPage + 1,
      loadingEffect: true,
    });
    selectedJobId.value = store.listJobs[0]?.id ?? null;
  }
};

const updatePreference = async (
  preference: 'like' | 'dislike',
) => {
  await store.updateListJobPreference(
    selectedJob.value.id,
    preference,
  );
  selectedJobId.value = store.listJobs[0]?.id ?? null;
};

const jobDetailDrawerRef = ref<HTMLDivElement | null>(null);

const listItemElMap = new Map<string, HTMLElement>();

const setListItemRef = (el: unknown, jobId: string) => {
  if (el) {
    listItemElMap.set(
      jobId,
      (el as { $el: HTMLElement }).$el,
    );
  } else {
    listItemElMap.delete(jobId);
  }
};

watch(selectedJobId, async newId => {
  if (jobDetailDrawerRef.value) {
    jobDetailDrawerRef.value.scrollTop = 0;
  }
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
  <div
    class="bg-surface-container-lowest overflow-hidden rounded-xl shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
  >
    <div
      v-if="store.loading"
      class="divide-surface-container divide-y"
    >
      <div
        v-for="i in store.listPageSize"
        :key="i"
        class="flex animate-pulse flex-col gap-2 p-4"
      >
        <div class="flex items-center gap-2">
          <div
            class="bg-surface-container-high h-4 w-1/2 rounded"
          ></div>
          <div
            class="bg-surface-container-high ml-auto h-3 w-3 rounded"
          ></div>
        </div>
        <div class="flex gap-3">
          <div
            class="bg-surface-container-high h-3 w-24 rounded"
          ></div>
          <div
            class="bg-surface-container-high h-3 w-20 rounded"
          ></div>
        </div>
        <div class="flex gap-3">
          <div
            class="bg-surface-container-high h-3 w-24 rounded"
          ></div>
          <div
            class="bg-surface-container-high ml-auto h-3 w-16 rounded"
          ></div>
        </div>
      </div>
    </div>

    <div
      v-else-if="store.listJobs.length === 0"
      class="flex flex-col items-center justify-center p-12 text-center"
    >
      <span
        class="material-symbols-outlined text-on-surface-variant/50 mb-4 text-6xl"
        data-icon="search_off"
        >search_off</span
      >
      <h2 class="text-on-surface mb-2 text-xl font-bold">
        此篩選條件已經沒有職缺
      </h2>
      <p class="text-on-surface-variant mb-6 text-sm">
        請嘗試切換別的篩選組合或清空篩選條件，以探索更多機會。
      </p>
      <button
        v-if="props.hasActiveFilters"
        class="bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container cursor-pointer rounded-full px-6 py-2 text-sm font-bold tracking-wider transition-colors"
        @click="emit('clearAllFilters')"
      >
        清空所有篩選
      </button>
    </div>

    <template v-else>
      <ul class="divide-surface-container divide-y pl-0">
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
        class="border-surface-container border-t px-5 py-3"
      >
        <span
          class="text-on-surface-variant mb-2 block text-sm font-medium"
        >
          第 {{ store.listPage }} / {{ totalPages }} 頁・共
          {{ store.listTotalCount }} 筆
        </span>
        <Pagination
          :current-page="store.listPage"
          :total-pages="totalPages"
          @update:current-page="goToPage"
        />
      </div>
    </template>
  </div>

  <Teleport to="body">
    <Transition name="drawer">
      <div
        v-if="selectedJobId && selectedJob"
        class="fixed inset-0 z-50 flex"
      >
        <div
          class="fixed inset-0 bg-black/50"
          @click="selectedJobId = null"
        ></div>
        <div
          ref="jobDetailDrawerRef"
          class="bg-surface relative z-10 ml-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto shadow-2xl"
        >
          <div
            class="border-surface-container flex shrink-0 items-center justify-between border-b px-6 py-4"
          >
            <span
              class="text-on-surface-variant text-sm font-bold tracking-widest "
            >
              {{
                store.listViewPreference === 'like'
                  ? '喜歡的職缺'
                  : store.listViewPreference === 'dislike'
                    ? '不喜歡的職缺'
                    : '職缺'
              }}
            </span>
            <button
              class="text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
              @click="selectedJobId = null"
            >
              <span class="material-symbols-outlined"
                >close</span
              >
            </button>
          </div>
          <div class="flex flex-1 flex-col p-4">
            <JobCard :job="selectedJob" />
          </div>
          <div
            class="border-surface-container flex shrink-0 items-center justify-center gap-8 border-t pt-6 pb-10"
            :class="{
              'pointer-events-none opacity-50':
                store.loading,
            }"
          >
            <button
              :disabled="isFirstJobOnFirstPage"
              class="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200"
              :class="
                isFirstJobOnFirstPage
                  ? 'bg-surface-container text-on-surface-variant/30 cursor-not-allowed'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high cursor-pointer active:scale-90'
              "
              @click="goToPrevJob"
            >
              <span class="material-symbols-outlined"
                >chevron_left</span
              >
            </button>
            <button
              :disabled="
                store.listViewPreference === 'dislike'
              "
              class="group flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-all duration-300"
              :class="
                store.listViewPreference === 'dislike'
                  ? 'bg-error text-on-primary cursor-not-allowed opacity-50'
                  : 'bg-surface-container-highest text-on-surface hover:bg-error hover:text-on-primary cursor-pointer active:scale-90'
              "
              @click="updatePreference('dislike')"
            >
              <span
                class="material-symbols-outlined text-3xl transition-transform group-hover:rotate-90"
                >close</span
              >
            </button>
            <button
              :disabled="
                store.listViewPreference === 'like'
              "
              class="from-primary to-primary-container group relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br text-white shadow-xl transition-all duration-300"
              :class="
                store.listViewPreference === 'like'
                  ? 'ring-primary cursor-not-allowed opacity-50 ring-4 ring-offset-2'
                  : 'cursor-pointer hover:shadow-2xl active:scale-90'
              "
              @click="updatePreference('like')"
            >
              <div
                class="bg-primary absolute inset-0 animate-ping rounded-full opacity-0 group-hover:opacity-20"
              ></div>
              <span
                class="material-symbols-outlined text-4xl"
                style="font-variation-settings: 'FILL' 1"
                >favorite</span
              >
            </button>
            <button
              :disabled="isLastJobOnLastPage"
              class="flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200"
              :class="
                isLastJobOnLastPage
                  ? 'bg-surface-container text-on-surface-variant/30 cursor-not-allowed'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high cursor-pointer active:scale-90'
              "
              @click="goToNextJob"
            >
              <span class="material-symbols-outlined"
                >chevron_right</span
              >
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
  .bg-black\/50 {
    transition: opacity 0.25s ease;
  }
  > div:last-child {
    transition: transform 0.25s ease;
  }
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  > div:last-child {
    transform: translateX(100%);
  }
}
</style>

