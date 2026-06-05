<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { useHomeStore } from '../useHomeStore';

defineProps<{ loading: boolean }>();

const store = useHomeStore();
const router = useRouter();

const statCards = [
  {
    label: '所有職缺',
    valKey: 'open' as const,
    query: {} as Record<string, string>,
  },
  {
    label: '月薪職缺',
    valKey: 'month' as const,
    query: { salary: 'excluding', salaryType: 'month' },
  },
  {
    label: '年薪職缺',
    valKey: 'year' as const,
    query: { salary: 'excluding', salaryType: 'year' },
  },
];

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}
</script>

<template>
  <section class="mt-10">
    <div class="mb-4 text-xs font-bold tracking-[0.18em] text-[#434653]">
      現在有多少缺？
    </div>
    <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div
        v-for="i in 3"
        :key="i"
        class="flex animate-pulse flex-col gap-2 rounded-xl bg-white p-5 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
      >
        <div class="h-3 w-16 rounded bg-[#001f2a]/8" />
        <div class="h-10 w-28 rounded bg-[#001f2a]/8" />
        <div class="h-3 w-20 rounded bg-[#001f2a]/8" />
      </div>
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <button
        v-for="(card, i) in statCards"
        :key="card.label"
        class="group flex cursor-pointer flex-col gap-1.5 rounded-xl p-5 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        :class="
          i === 0
            ? 'bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]'
            : 'bg-[#f4faff] hover:bg-[#d9f2ff]'
        "
        @click="goJobs(card.query)"
      >
        <span class="text-xs font-bold tracking-widest text-[#434653]">{{ card.label }}</span>
        <span
          class="tabular-nums leading-none font-black tracking-[-0.03em] text-[#003d92]"
          style="font-size: 2.75rem"
        >{{ store.jobCountText[card.valKey] }}</span>
        <span
          class="mt-1 flex items-center gap-1 text-xs font-bold text-[#003d92]"
        >
          前往查看
          <span class="material-symbols-outlined" style="font-size: 14px">arrow_forward</span>
        </span>
      </button>
    </div>
  </section>

</template>
