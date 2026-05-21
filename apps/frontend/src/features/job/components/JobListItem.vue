<script lang="ts" setup>
import dayjs from 'dayjs';
import { computed } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { formatDateInfo } from '../../../utils/format';
import { useJobStore } from '../useJobStore';

type Props = {
  job: SupabaseView.JobView;
  selected: boolean;
};

type Emits = {
  (e: 'select', jobId: string): void;
};

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const store = useJobStore();

const updatedAt = computed(() => dayjs(props.job.updated_at));

const formattedUpdatedAt = computed(() =>
  props.job.updated_at
    ? updatedAt.value.format('MM/DD HH:mm')
    : '--/-- --:--',
);

const updatedAtInfo = computed(() =>
  formatDateInfo(updatedAt.value, formattedUpdatedAt.value),
);

const handleSelect = () => {
  emit('select', props.job.id);
};

const handleLike = async (event: MouseEvent) => {
  event.stopPropagation();
  await store.updateListJobPreference(
    props.job.id,
    'like',
  );
};

const handleDislike = async (event: MouseEvent) => {
  event.stopPropagation();
  await store.updateListJobPreference(
    props.job.id,
    'dislike',
  );
};
</script>

<template>
  <li
    class="flex min-w-0 cursor-pointer flex-col gap-1 overflow-hidden px-5 py-3 transition-colors"
    :class="[
      job.closed ? 'opacity-60' : '',
      selected
        ? 'bg-primary/10 hover:bg-primary/15'
        : 'hover:bg-surface-container',
    ]"
    @click="handleSelect"
  >
    <div
      class="flex min-w-0 items-center gap-1.5 overflow-hidden"
    >
      <span
        class="min-w-0 flex-1 truncate font-bold"
        :class="
          job.closed ? 'text-on-surface/40' : 'text-on-surface'
        "
        >{{ job.title }}</span
      >
      <span
        v-if="job.closed"
        class="bg-error/15 text-error shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black tracking-widest "
        >已關閉</span
      >
      <a
        :href="job.detail_link"
        target="_blank"
        class="shrink-0"
        @click.stop
      >
        <span
          class="material-symbols-outlined text-primary text-sm leading-none"
          >open_in_new</span
        >
      </a>
    </div>
    <div
      class="text-on-surface-variant mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"
    >
      <span class="font-medium">{{ job.company_name }}</span>
    </div>
    <div
      class="text-on-surface-variant mb-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"
    >
      <span class="flex items-center gap-0.5">
        {{ job.salary }}
      </span>
    </div>
    <div
      class="text-on-surface-variant flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"
    >
      <span class="flex items-center gap-0.5">
        {{ job.location }}
      </span>
      <span class="ml-auto shrink-0">
        {{ updatedAtInfo }}
      </span>
    </div>
    <div class="mt-1 flex items-center justify-end gap-2" @click.stop>
      <button
        :disabled="
          store.listViewPreference === 'dislike' || store.loading
        "
        class="group flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-all duration-200"
        :class="
          store.listViewPreference === 'dislike'
            ? 'bg-error text-on-primary cursor-not-allowed opacity-50'
            : 'bg-surface-container-highest text-on-surface hover:bg-error hover:text-on-primary cursor-pointer active:scale-90'
        "
        @click="handleDislike"
      >
        <span
          class="material-symbols-outlined text-base! transition-transform group-hover:rotate-90"
          >close</span
        >
      </button>
      <button
        :disabled="
          store.listViewPreference === 'like' || store.loading
        "
        class="from-primary to-primary-container group relative flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br text-white shadow-md transition-all duration-200"
        :class="
          store.listViewPreference === 'like'
            ? 'ring-primary cursor-not-allowed opacity-50 ring-2 ring-offset-1'
            : 'cursor-pointer hover:shadow-lg active:scale-90'
        "
        @click="handleLike"
      >
        <div
          class="bg-primary absolute inset-0 animate-ping rounded-full opacity-0 group-hover:opacity-20"
        ></div>
        <span
          class="material-symbols-outlined text-base!"
          style="font-variation-settings: 'FILL' 1"
          >favorite</span
        >
      </button>
    </div>
  </li>
</template>
