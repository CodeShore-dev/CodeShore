<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Pagination from '../../../components/Pagination.vue';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useHomeStore } from '../../home/useHomeStore';
import TechRankingCard from '../components/TechRankingCard.vue';
import {
  RankingMode,
  useTechRanking,
} from '../composables/useTechRanking';

const route = useRoute();
const router = useRouter();
const homeStore = useHomeStore();

const PAGE_SIZE = 24;

const MODE_OPTIONS: {
  value: RankingMode;
  label: string;
}[] = [
  { value: 'popular', label: '熱門技術' },
  { value: 'salary-year', label: '高薪 · 年薪' },
  { value: 'salary-month', label: '高薪 · 月薪' },
];

const categoryOptions = Object.entries(
  CATEGORY_LABEL_MAP,
).map(([value, label]) => ({ value, label }));

function isMode(v: unknown): v is RankingMode {
  return (
    v === 'popular' ||
    v === 'salary-year' ||
    v === 'salary-month'
  );
}

const mode = ref<RankingMode>(
  isMode(route.query.mode) ? route.query.mode : 'popular',
);
const category = ref('language');
const page = ref(1);

const { items, totalCount, loading, fetchPage } =
  useTechRanking();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)),
);

const heading = computed(() =>
  mode.value === 'popular'
    ? '最多職缺要的技術'
    : '開最高薪的技術',
);

async function load() {
  let salaryMedian = 0;
  if (mode.value !== 'popular') {
    if (homeStore.salaryTypeMedianRatio.length === 0) {
      await homeStore.getMvSalaryTypeMedianRatio();
    }
    const type =
      mode.value === 'salary-year' ? 'year' : 'month';
    salaryMedian = homeStore.salaryBenchmarks[type].median;
  }
  await fetchPage({
    mode: mode.value,
    category: category.value,
    page: page.value,
    pageSize: PAGE_SIZE,
    salaryMedian,
  });
}

function setMode(value: RankingMode) {
  if (mode.value === value) return;
  mode.value = value;
  page.value = 1;
  router.replace({
    query: { ...route.query, mode: value },
  });
  load();
}

function setCategory(value: string) {
  if (category.value === value) return;
  category.value = value;
  page.value = 1;
  load();
}

function goToPage(value: number) {
  page.value = value;
  load();
}

load();
</script>

<template>
  <div class="w-full">
    <!-- Page heading -->
    <div class="mb-8">
      <div
        class="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]"
      >
        ● 技術排行 · TECH RANKING
      </div>
      <div class="flex items-end justify-between gap-4">
        <h1
          class="text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]"
        >
          {{ heading }}
        </h1>
        <span
          v-if="!loading"
          class="shrink-0 pb-1 text-sm font-semibold text-[#434653]"
        >
          共 {{ totalCount.toLocaleString() }} 項
        </span>
      </div>
    </div>

    <!-- Mode toggle -->
    <div
      class="mb-3 flex w-full flex-wrap overflow-hidden rounded-lg border border-[#c9e7f7] text-sm md:w-fit"
    >
      <button
        v-for="opt in MODE_OPTIONS"
        :key="opt.value"
        class="flex-1 cursor-pointer px-4 py-2 font-bold transition-colors md:flex-none"
        :class="
          mode === opt.value
            ? 'bg-[#003d92] text-white'
            : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
        "
        @click="setMode(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Category tabs -->
    <div class="mb-6 flex flex-wrap gap-2 text-xs">
      <button
        v-for="opt in categoryOptions"
        :key="opt.value"
        class="cursor-pointer rounded-lg border px-3.5 py-1.5 font-bold transition-colors"
        :class="
          category === opt.value
            ? 'border-[#003d92] bg-[#003d92] text-white'
            : 'border-[#c9e7f7] bg-white text-[#434653] hover:bg-[#d9f2ff]'
        "
        @click="setCategory(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <div
        v-for="i in 10"
        :key="i"
        class="h-40 animate-pulse rounded-xl bg-[#d9f2ff]"
      />
    </div>

    <!-- Empty -->
    <div
      v-else-if="items.length === 0"
      class="py-24 text-center"
    >
      <div
        class="mb-3 text-5xl font-black text-[#001f2a]/10"
      >
        0
      </div>
      <p class="text-sm font-bold text-[#434653]">
        這個類別下沒有符合條件的技術
      </p>
    </div>

    <!-- Grid -->
    <template v-else>
      <div
        class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        <TechRankingCard
          v-for="(item, i) in items"
          :key="item.keyword_group"
          :item="item"
          :rank="(page - 1) * PAGE_SIZE + i + 1"
          :mode="mode"
        />
      </div>
      <Pagination
        :current-page="page"
        :total-pages="totalPages"
        @update:current-page="goToPage($event)"
      />
    </template>
  </div>
</template>
