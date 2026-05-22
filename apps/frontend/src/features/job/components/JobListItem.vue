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
  props.job.updated_at ? updatedAt.value.format('MM/DD HH:mm') : '--/-- --:--',
);
const updatedAtInfo = computed(() =>
  formatDateInfo(updatedAt.value, formattedUpdatedAt.value),
);

const handleSelect = () => emit('select', props.job.id);

const handleLike = async (event: MouseEvent) => {
  event.stopPropagation();
  await store.updateListJobPreference(props.job.id, 'like');
};
const handleDislike = async (event: MouseEvent) => {
  event.stopPropagation();
  await store.updateListJobPreference(props.job.id, 'dislike');
};
</script>

<template>
  <li
    class="flex min-w-0 cursor-pointer gap-4 overflow-hidden border-l-[3px] px-5 py-5 transition-all"
    :class="[
      job.closed ? 'opacity-60' : '',
      selected
        ? 'border-l-[#003d92] bg-[#003d92]/[0.06]'
        : 'border-l-transparent hover:bg-[#001f2a]/[0.025]',
    ]"
    @click="handleSelect"
  >
    <!-- Main content -->
    <div class="min-w-0 flex-1">
      <!-- Company + closed badge -->
      <div class="mb-1 flex items-center gap-2">
        <span
          v-if="job.closed"
          class="rounded bg-[#ffdad6] px-1.5 py-0.5 text-[9px] font-black tracking-[0.05em] text-[#93000a]"
        >已關閉</span>
        <span class="text-[13px] font-bold text-[#434653]">{{ job.company_name }}</span>
      </div>

      <!-- Job title -->
      <div
        class="mb-2.5 text-[22px] font-black leading-tight tracking-[-0.01em] break-words"
        :class="job.closed ? 'text-[#001f2a]/40' : 'text-[#001f2a]'"
      >
        {{ job.title }}
      </div>

      <!-- Meta row -->
      <div class="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#434653]">
        <span class="inline-flex items-center gap-1">
          <span class="material-symbols-outlined" style="font-size:14px">location_on</span>
          {{ job.location }}
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="material-symbols-outlined" style="font-size:14px">payments</span>
          {{ job.salary }}
        </span>
        <span class="inline-flex items-center gap-1 ml-auto">
          <span class="material-symbols-outlined" style="font-size:14px">update</span>
          {{ updatedAtInfo }}
        </span>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex shrink-0 flex-col items-center gap-2 pt-1" @click.stop>
      <!-- Like -->
      <button
        :disabled="store.listViewPreference === 'dislike' || store.loading"
        class="group relative flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-all"
        :class="
          store.listViewPreference === 'dislike'
            ? 'cursor-not-allowed opacity-40 bg-[#c9e7f7]'
            : 'cursor-pointer bg-gradient-to-br from-[#003d92] to-[#1654b9] hover:shadow-md active:scale-90'
        "
        @click="handleLike"
      >
        <div v-if="store.listViewPreference !== 'dislike'" class="absolute inset-0 animate-ping rounded-full bg-[#003d92] opacity-0 group-hover:opacity-20" />
        <span class="material-symbols-outlined" style="font-size:18px; font-variation-settings: 'FILL' 1">favorite</span>
      </button>

      <!-- Dislike -->
      <button
        :disabled="store.listViewPreference === 'like' || store.loading"
        class="group flex h-9 w-9 items-center justify-center rounded-full transition-all"
        :class="
          store.listViewPreference === 'like'
            ? 'cursor-not-allowed bg-[#c9e7f7] text-[#434653] opacity-40'
            : 'cursor-pointer bg-[#c9e7f7] text-[#434653] hover:bg-[#ba1a1a] hover:text-white active:scale-90'
        "
        @click="handleDislike"
      >
        <span
          class="material-symbols-outlined transition-transform group-hover:rotate-90"
          style="font-size:18px"
        >close</span>
      </button>

      <!-- Open original -->
      <a :href="job.detail_link" target="_blank" class="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#e6f6ff] text-[#003d92] hover:bg-[#003d92] hover:text-white transition-colors" @click.stop>
        <span class="material-symbols-outlined" style="font-size:14px">open_in_new</span>
      </a>
    </div>
  </li>
</template>
