<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { useAuthStore } from '../../auth/useAuthStore';
import { useJobStore } from '../useJobStore';

type Props = {
  jobId: string;
};

const props = defineProps<Props>();

const store = useJobStore();
const authStore = useAuthStore();

const crawlScrollRef = ref<HTMLDivElement | null>(null);

watch(
  () => store.crawlProgress.length,
  async () => {
    await nextTick();
    if (crawlScrollRef.value) {
      crawlScrollRef.value.scrollTop =
        crawlScrollRef.value.scrollHeight;
    }
  },
);

onBeforeUnmount(() => {
  if (
    store.crawlJobId === props.jobId &&
    !store.crawlDone
  ) {
    store.crawlJobId = null;
  }
});
</script>

<template>
  <div>
    <button
      @click="store.clickToCrawlJob(jobId)"
      :disabled="
        (store.crawlJobId === jobId && !store.crawlDone) ||
        !authStore.canEdit
      "
      class="text-primary hover:bg-primary-container flex h-fit w-fit cursor-pointer items-center justify-center rounded-md pr-2 pl-1 text-sm transition-all hover:text-white active:scale-90 disabled:cursor-not-allowed! disabled:opacity-50"
    >
      <span
        class="material-symbols-outlined mr-1 text-sm"
        :class="{
          'animate-spin':
            store.crawlJobId === jobId && !store.crawlDone,
        }"
        data-icon="bug_report"
        >{{
          store.crawlJobId === jobId && !store.crawlDone
            ? 'progress_activity'
            : 'bug_report'
        }}</span
      >
      重新爬取
    </button>

    <div
      v-if="store.crawlJobId === jobId"
      class="border-surface-container mt-3 overflow-hidden rounded-lg border"
    >
      <div
        class="bg-surface-container flex items-center justify-between px-3 py-2"
      >
        <span
          class="text-on-surface-variant text-sm font-bold tracking-widest "
          >爬取進度</span
        >
        <button
          v-if="store.crawlDone"
          class="text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors"
          @click="store.crawlJobId = null"
        >
          ✕
        </button>
        <span
          v-else
          class="material-symbols-outlined text-primary animate-spin text-sm"
          >progress_activity</span
        >
      </div>
      <div
        ref="crawlScrollRef"
        class="bg-surface-container-lowest max-h-48 overflow-y-auto p-3 font-mono text-[11px]"
      >
        <div
          v-for="(line, i) in store.crawlProgress"
          :key="i"
          class="text-on-surface-variant leading-5 break-all whitespace-pre-wrap"
        >
          {{ line }}
        </div>
        <div
          v-if="store.crawlDone && store.crawlProgress.length === 0"
          class="text-on-surface-variant/50 italic"
        >
          完成
        </div>
        <div
          v-if="!store.crawlDone && store.crawlProgress.length === 0"
          class="text-on-surface-variant/50 italic"
        >
          啟動中...
        </div>
      </div>
    </div>
  </div>
</template>
