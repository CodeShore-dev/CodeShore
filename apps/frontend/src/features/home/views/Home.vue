<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { SupabaseFunction } from '@codeshore/data-types';

import { useHomeStore } from '../useHomeStore';

const store = useHomeStore();
const router = useRouter();

const loading = ref(true);
Promise.all([
  store.getSalaryRange(),
  store.getJobCount(),
  store.getTechStats(),
  store.getTechComboStats(),
  store.getSalaryStats(),
]).finally(() => { loading.value = false; });

function toWan(n: number | null | undefined): string {
  if (!n) return '—';
  return (n / 10000).toFixed(n % 10000 ? 1 : 0) + '萬';
}

type TechSortKey = 'count' | 'month' | 'year';
const techSort = ref<TechSortKey>('count');
const techCategory = ref<'all' | 'Language' | 'Framework'>('all');

function techAvgMonth(t: SupabaseFunction.TechStat): number {
  if (!t.avg_min_month || !t.avg_max_month) return 0;
  return (t.avg_min_month + t.avg_max_month) / 2;
}
function techAvgYear(t: SupabaseFunction.TechStat): number {
  if (!t.avg_min_year || !t.avg_max_year) return 0;
  return (t.avg_min_year + t.avg_max_year) / 2;
}

const sortedTechStats = computed(() => {
  let list = store.techStats;
  if (techCategory.value !== 'all') {
    list = list.filter(t => t.category === techCategory.value);
  }
  return [...list].sort((a, b) => {
    if (techSort.value === 'count') return b.job_count - a.job_count;
    if (techSort.value === 'month') return techAvgMonth(b) - techAvgMonth(a);
    return techAvgYear(b) - techAvgYear(a);
  });
});

type ComboSortKey = 'count' | 'month' | 'year';
const comboSort = ref<ComboSortKey>('count');

function comboAvgMonth(c: SupabaseFunction.TechComboStat): number {
  if (!c.avg_min_month || !c.avg_max_month) return 0;
  return (c.avg_min_month + c.avg_max_month) / 2;
}
function comboAvgYear(c: SupabaseFunction.TechComboStat): number {
  if (!c.avg_min_year || !c.avg_max_year) return 0;
  return (c.avg_min_year + c.avg_max_year) / 2;
}

const sortedComboStats = computed(() => {
  return [...store.techComboStats].sort((a, b) => {
    if (comboSort.value === 'count') return b.job_count - a.job_count;
    if (comboSort.value === 'month') return comboAvgMonth(b) - comboAvgMonth(a);
    return comboAvgYear(b) - comboAvgYear(a);
  });
});

const catLabel: Record<string, string> = {
  Language: '語言',
  Framework: '框架',
};

const monthBenchmarks = computed(() => [
  { label: '均標', value: store.salaryBenchmarks.month['均標'] },
  { label: '高標', value: store.salaryBenchmarks.month['高標'] },
  { label: '頂標', value: store.salaryBenchmarks.month['頂標'] },
]);

const yearBenchmarks = computed(() => [
  { label: '均標', value: store.salaryBenchmarks.year['均標'] },
  { label: '高標', value: store.salaryBenchmarks.year['高標'] },
  { label: '頂標', value: store.salaryBenchmarks.year['頂標'] },
]);

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}
</script>

<template>
  <div class="w-full space-y-10 pb-16">
    <!-- Hero -->
    <section class="text-center">
      <h1 class="text-on-surface text-3xl font-black tracking-tight md:text-4xl">
        找到你的<span class="text-primary">下一份工作</span>
      </h1>
      <p class="text-on-surface-variant mt-2 text-sm">
        彙整台灣工程師職缺資料，快速掌握市場行情
      </p>
    </section>

    <!-- Job count cards -->
    <section>
      <h2 class="text-on-surface-variant mb-3 text-xs font-bold tracking-widest ">
        職缺總覽
      </h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          class="bg-surface-container-low hover:bg-surface-container group flex cursor-pointer flex-col items-start rounded-xl p-5 text-left transition-all active:scale-[0.98]"
          @click="goJobs()"
        >
          <span class="text-on-surface-variant mb-1 text-xs font-bold tracking-wider ">所有職缺</span>
          <span class="text-primary text-3xl font-black">{{ store.jobCountText.total }}</span>
          <span class="text-on-surface-variant mt-1 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
            查看全部
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </button>

        <button
          class="bg-surface-container-low hover:bg-surface-container group flex cursor-pointer flex-col items-start rounded-xl p-5 text-left transition-all active:scale-[0.98]"
          @click="goJobs({ salary: 'excluding', salaryType: 'month' })"
        >
          <span class="text-on-surface-variant mb-1 text-xs font-bold tracking-wider ">月薪職缺</span>
          <span class="text-primary text-3xl font-black">{{ store.jobCountText.month }}</span>
          <span class="text-on-surface-variant mt-1 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
            查看月薪職缺
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </button>

        <button
          class="bg-surface-container-low hover:bg-surface-container group flex cursor-pointer flex-col items-start rounded-xl p-5 text-left transition-all active:scale-[0.98]"
          @click="goJobs({ salary: 'excluding', salaryType: 'year' })"
        >
          <span class="text-on-surface-variant mb-1 text-xs font-bold tracking-wider ">年薪職缺</span>
          <span class="text-primary text-3xl font-black">{{ store.jobCountText.year }}</span>
          <span class="text-on-surface-variant mt-1 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
            查看年薪職缺
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </button>
      </div>
    </section>

    <!-- Salary benchmarks -->
    <section>
      <h2 class="text-on-surface-variant mb-3 text-xs font-bold tracking-widest ">
        市場薪資行情
      </h2>
      <div class="space-y-4">
        <div>
          <p class="text-on-surface-variant mb-2 text-xs font-bold">月薪（有薪資職缺）</p>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="bm in monthBenchmarks"
              :key="bm.label"
              class="bg-surface-container-low group hover:bg-surface-container flex cursor-pointer flex-col items-center rounded-xl p-4 transition-all active:scale-[0.98]"
              @click="goJobs({ salary: 'excluding', salaryType: 'month' })"
            >
              <span class="text-on-surface-variant mb-1 text-xs font-bold">{{ bm.label }}</span>
              <span class="text-on-surface text-xl font-black">{{ toWan(bm.value) }}</span>
              <span class="text-primary mt-2 flex items-center gap-0.5 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
                查看職缺
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </span>
            </button>
          </div>
        </div>

        <div>
          <p class="text-on-surface-variant mb-2 text-xs font-bold">年薪（有薪資職缺）</p>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="bm in yearBenchmarks"
              :key="bm.label"
              class="bg-surface-container-low group hover:bg-surface-container flex cursor-pointer flex-col items-center rounded-xl p-4 transition-all active:scale-[0.98]"
              @click="goJobs({ salary: 'excluding', salaryType: 'year' })"
            >
              <span class="text-on-surface-variant mb-1 text-xs font-bold">{{ bm.label }}</span>
              <span class="text-on-surface text-xl font-black">{{ toWan(bm.value) }}</span>
              <span class="text-primary mt-2 flex items-center gap-0.5 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
                查看職缺
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Popular tech -->
    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-on-surface-variant text-xs font-bold tracking-widest ">
          熱門語言 & 框架
        </h2>
        <div class="flex flex-wrap gap-2">
          <div class="border-surface-container-highest flex overflow-hidden rounded-lg border text-xs">
            <button
              v-for="opt in [{ v: 'all', l: '全部' }, { v: 'Language', l: '語言' }, { v: 'Framework', l: '框架' }]"
              :key="opt.v"
              class="cursor-pointer px-3 py-1 font-bold transition-colors"
              :class="techCategory === opt.v ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
              @click="techCategory = (opt.v as typeof techCategory)"
            >{{ opt.l }}</button>
          </div>
          <div class="border-surface-container-highest flex overflow-hidden rounded-lg border text-xs">
            <button
              v-for="opt in [{ v: 'count', l: '職缺數' }, { v: 'month', l: '月薪' }, { v: 'year', l: '年薪' }]"
              :key="opt.v"
              class="cursor-pointer px-3 py-1 font-bold transition-colors"
              :class="techSort === opt.v ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
              @click="techSort = (opt.v as TechSortKey)"
            >{{ opt.l }}</button>
          </div>
        </div>
      </div>

      <!-- skeleton -->
      <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <div
          v-for="i in 10"
          :key="i"
          class="bg-surface-container-low h-28 animate-pulse rounded-xl"
        />
      </div>

      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <button
          v-for="tech in sortedTechStats"
          :key="tech.keyword_group"
          class="bg-surface-container-low hover:bg-surface-container group flex cursor-pointer flex-col rounded-xl p-4 text-left transition-all active:scale-[0.98]"
          @click="goJobs({ tags: tech.keyword_group })"
        >
          <div class="mb-2 flex items-start justify-between gap-1">
            <span class="text-on-surface text-sm font-black leading-tight">{{ tech.keyword_group }}</span>
            <span class="bg-surface-container-highest text-on-surface-variant shrink-0 rounded px-1.5 py-0.5 text-xs font-bold">
              {{ catLabel[tech.category] ?? tech.category }}
            </span>
          </div>
          <span class="text-on-surface-variant mb-2 text-xs">{{ tech.job_count.toLocaleString() }} 個職缺</span>
          <div class="space-y-0.5">
            <div v-if="tech.avg_min_month && tech.avg_max_month" class="text-on-surface-variant flex items-center gap-1 text-xs">
              <span class="text-secondary font-bold">月</span>
              <span>{{ toWan(tech.avg_min_month) }}~{{ toWan(tech.avg_max_month) }}</span>
            </div>
            <div v-if="tech.avg_min_year && tech.avg_max_year" class="text-on-surface-variant flex items-center gap-1 text-xs">
              <span class="text-secondary font-bold">年</span>
              <span>{{ toWan(tech.avg_min_year) }}~{{ toWan(tech.avg_max_year) }}</span>
            </div>
          </div>
          <span class="text-primary mt-2 flex items-center gap-0.5 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
            查看職缺
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </button>
      </div>
    </section>

    <!-- Popular combos -->
    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-on-surface-variant text-xs font-bold tracking-widest ">
          熱門技術組合
        </h2>
        <div class="border-surface-container-highest flex overflow-hidden rounded-lg border text-xs">
          <button
            v-for="opt in [{ v: 'count', l: '職缺數' }, { v: 'month', l: '月薪' }, { v: 'year', l: '年薪' }]"
            :key="opt.v"
            class="cursor-pointer px-3 py-1 font-bold transition-colors"
            :class="comboSort === opt.v ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
            @click="comboSort = (opt.v as ComboSortKey)"
          >{{ opt.l }}</button>
        </div>
      </div>

      <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="i in 8"
          :key="i"
          class="bg-surface-container-low h-32 animate-pulse rounded-xl"
        />
      </div>

      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <button
          v-for="combo in sortedComboStats"
          :key="`${combo.tech1}+${combo.tech2}`"
          class="bg-surface-container-low hover:bg-surface-container group flex cursor-pointer flex-col rounded-xl p-4 text-left transition-all active:scale-[0.98]"
          @click="goJobs({ tags: `${combo.tech1},${combo.tech2}` })"
        >
          <div class="mb-1 flex flex-wrap items-center gap-1.5">
            <span class="text-on-surface text-sm font-black">{{ combo.tech1 }}</span>
            <span class="text-on-surface-variant text-xs font-bold">+</span>
            <span class="text-on-surface text-sm font-black">{{ combo.tech2 }}</span>
          </div>
          <div class="mb-2 flex gap-1.5">
            <span
              v-for="(cat, i) in [combo.cat1, combo.cat2]"
              :key="i"
              class="bg-surface-container-highest text-on-surface-variant rounded px-1.5 py-0.5 text-xs font-bold"
            >{{ catLabel[cat] ?? cat }}</span>
          </div>
          <span class="text-on-surface-variant mb-2 text-xs">{{ combo.job_count.toLocaleString() }} 個職缺</span>
          <div class="space-y-0.5">
            <div v-if="combo.avg_min_month && combo.avg_max_month" class="text-on-surface-variant flex items-center gap-1 text-xs">
              <span class="text-secondary font-bold">月</span>
              <span>{{ toWan(combo.avg_min_month) }}~{{ toWan(combo.avg_max_month) }}</span>
            </div>
            <div v-if="combo.avg_min_year && combo.avg_max_year" class="text-on-surface-variant flex items-center gap-1 text-xs">
              <span class="text-secondary font-bold">年</span>
              <span>{{ toWan(combo.avg_min_year) }}~{{ toWan(combo.avg_max_year) }}</span>
            </div>
          </div>
          <span class="text-primary mt-2 flex items-center gap-0.5 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
            查看職缺
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>
