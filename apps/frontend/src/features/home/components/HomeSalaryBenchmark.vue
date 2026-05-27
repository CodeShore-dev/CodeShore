<script lang="ts" setup>
import { computed, ref } from 'vue';

import { toWanInt } from '../../../utils/format';
import { useHomeStore } from '../useHomeStore';

defineProps<{ loading: boolean }>();

const store = useHomeStore();

const salaryUnit = ref<'month' | 'year'>('year');

const benchmarkDescriptions: Record<string, Record<string, string>> = {
  month: {
    均標: '市場中位數，新鮮人到資淺工程師的常見區間。',
    高標: '前 25%，資深或外商偏多。',
    頂標: '前 10%，頂尖資深或外商高階。',
  },
  year: {
    均標: '市場中位數，多半含年終與獎金。',
    高標: '前 25%，資深或外商偏多。',
    頂標: '前 10%，頂尖資深或外商高階。',
  },
};

const benchmarkTags: Record<string, string> = {
  均標: 'PR50',
  高標: 'PR75',
  頂標: 'PR88',
};

const activeBenchmarks = computed(() => {
  const bm =
    salaryUnit.value === 'month'
      ? store.salaryBenchmarks.month
      : store.salaryBenchmarks.year;
  return [
    { label: '均標', value: bm['均標'], idx: 0 },
    { label: '高標', value: bm['高標'], idx: 1 },
    { label: '頂標', value: bm['頂標'], idx: 2 },
  ];
});
</script>

<template>
  <section class="mt-10">
    <div class="mb-4 flex items-baseline justify-between">
      <div class="text-xs font-bold tracking-[0.18em] text-[#434653]">
        市場薪資行情
      </div>
      <div class="flex overflow-hidden rounded-lg border border-[#c9e7f7] text-xs">
        <button
          v-for="opt in [
            { v: 'year', l: '年薪' },
            { v: 'month', l: '月薪' },
          ]"
          :key="opt.v"
          class="cursor-pointer px-3.5 py-1.5 font-bold transition-colors"
          :class="
            salaryUnit === opt.v
              ? 'bg-[#003d92] text-white'
              : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
          "
          @click="salaryUnit = opt.v as 'month' | 'year'"
        >
          {{ opt.l }}
        </button>
      </div>
    </div>
    <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div
        v-for="i in 3"
        :key="i"
        class="flex animate-pulse flex-col rounded-xl bg-white p-5 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
      >
        <div class="mb-4 flex items-center justify-between">
          <div class="h-4 w-8 rounded bg-[#001f2a]/[0.08]" />
          <div class="h-3 w-10 rounded bg-[#001f2a]/[0.08]" />
        </div>
        <div class="mb-3 h-14 w-32 rounded bg-[#001f2a]/[0.08]" />
        <div class="mb-1.5 h-3 w-full rounded bg-[#001f2a]/[0.08]" />
        <div class="mb-3 h-3 w-4/5 rounded bg-[#001f2a]/[0.08]" />
        <div class="mt-auto h-1.5 w-full rounded-full bg-[#001f2a]/[0.08]" />
      </div>
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div
        v-for="bm in activeBenchmarks"
        :key="bm.label"
        class="flex flex-col rounded-xl bg-white p-5 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
      >
        <div class="mb-3 flex items-baseline justify-between">
          <span class="text-sm font-black text-[#001f2a]">{{ bm.label }}</span>
          <span class="font-mono text-[10px] tracking-widest text-[#434653]">
            {{ benchmarkTags[bm.label] }}
          </span>
        </div>
        <div
          class="tabular-nums leading-[0.95] font-black tracking-[-0.03em] text-[#003d92]"
          style="font-size: 3.25rem"
        >
          {{ toWanInt(bm.value) }}<span class="text-[1.375rem] font-black text-[#434653]">萬</span>
        </div>
        <div
          class="mt-3 text-xs leading-[1.55] text-[#434653]"
          style="min-height: 38px"
        >
          {{ benchmarkDescriptions[salaryUnit][bm.label] }}
        </div>
        <!-- Progress bar -->
        <div class="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#d9f2ff]">
          <div
            class="bg-[#003d92] transition-all duration-500"
            :style="{ width: `${(bm.idx + 1) * 28}%` }"
          />
          <div class="w-[12%] bg-[#fd7700]" />
        </div>
      </div>
    </div>
  </section>
</template>
