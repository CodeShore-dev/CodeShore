<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { SupabaseView } from '@codeshore/data-types';

import {
  CATEGORY_LABEL_MAP,
  TAG_LABEL_MAP,
} from '../utils/constants';
import TechIcon from './TechIcon.vue';

const props = defineProps<{
  title: string;
  items: SupabaseView.MvKeywordGroupRanking[];
  loading: boolean;
  getItems: (category: string) => void;
}>();

const router = useRouter();

const selectedCategory = ref('language');

// Grid is 2/3/4/5 columns per breakpoint; always show 2 rows, so the
// surplus cards beyond each breakpoint's count are hidden via literal
// Tailwind classes (kept whole so the JIT scanner detects them).
const CARD_VISIBILITY = [
  'flex',
  'flex',
  'flex',
  'flex',
  'hidden sm:flex',
  'hidden sm:flex',
  'hidden md:flex',
  'hidden md:flex',
  'hidden lg:flex',
  'hidden lg:flex',
];
const SKELETON_VISIBILITY = [
  'block',
  'block',
  'block',
  'block',
  'hidden sm:block',
  'hidden sm:block',
  'hidden md:block',
  'hidden md:block',
  'hidden lg:block',
  'hidden lg:block',
];

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}

const categoryOptions = Object.entries(CATEGORY_LABEL_MAP)
  .map(([key, value]) => ({
    value: key,
    label: value,
  }))
  .slice(0, 4);

watch(
  selectedCategory,
  value => {
    props.getItems(value);
  },
  { immediate: true },
);
</script>

<template>
  <section class="mt-10">
    <div
      class="mb-4 flex flex-wrap items-baseline justify-between gap-2"
    >
      <div
        class="text-xs font-bold tracking-[0.18em] text-[#434653]"
      >
        {{ title }}
      </div>
      <div
        class="flex w-full flex-wrap overflow-hidden rounded-lg border border-[#c9e7f7] text-xs md:w-auto"
      >
        <button
          v-for="opt in categoryOptions"
          :key="opt.value"
          class="md:h-auo h-10 w-[24.9%] cursor-pointer px-3.5 py-1.5 font-bold transition-colors md:w-auto"
          :class="
            selectedCategory === opt.value
              ? 'bg-[#003d92] text-white'
              : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
          "
          @click="
            selectedCategory =
              opt.value as typeof selectedCategory
          "
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <div
        v-for="(visibility, i) in SKELETON_VISIBILITY"
        :key="i"
        class="h-28 animate-pulse rounded-xl bg-[#d9f2ff]"
        :class="visibility"
      />
    </div>
    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <button
        v-for="(item, i) in items"
        :key="item.keyword_group"
        class="group cursor-pointer flex-col rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        :class="CARD_VISIBILITY[i]"
        @click="goJobs({ tags: item.keyword_group })"
      >
        <div class="mb-2 flex flex-col items-start gap-1">
          <div
            class="font-mono text-[10px] tracking-[0.15em] text-[#434653]"
          >
            #{{ i + 1 }}
          </div>
          <div class="flex items-center gap-2">
            <TechIcon
              :slugs="item.icon_slugs"
              :label="item.label"
              :size="18"
            />
            <span
              class="text-lg leading-tight font-black tracking-tight text-[#001f2a]"
            >
              {{ item.label }}
            </span>
          </div>
          <div class="flex gap-1">
            <span
              v-for="tag in item.tags"
              class="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-1 text-[10px] font-bold text-[#434653]"
            >
              {{ TAG_LABEL_MAP[tag] }}
            </span>
          </div>
        </div>
        <div class="h-full">
          <slot name="metric" :item="item">
            <div
              class="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
              style="font-size: 1.5rem"
            >
              {{ item.job_count.toLocaleString() }}
            </div>
            <div class="mt-0.5 text-[11px] text-[#434653]">
              個職缺
            </div>
          </slot>
        </div>
        <span
          class="mt-1 flex items-end justify-end gap-1 text-xs font-bold text-[#003d92]"
        >
          前往職缺
          <span
            class="material-symbols-outlined"
            style="font-size: 14px"
          >
            arrow_forward
          </span>
        </span>
      </button>
    </div>
  </section>
</template>
