<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { useHomeStore } from '../useHomeStore';

const store = useHomeStore();
const router = useRouter();

const statCards = [
  {
    label: '所有職缺',
    valKey: 'total' as const,
    hint: '全部抓進來的',
    query: {} as Record<string, string>,
  },
  {
    label: '月薪職缺',
    valKey: 'month' as const,
    hint: 'JD 上有寫月薪數字的',
    query: { salary: 'excluding', salaryType: 'month' },
  },
  {
    label: '年薪職缺',
    valKey: 'year' as const,
    hint: 'JD 上有寫年薪的',
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
      職缺總覽
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <span class="text-xs text-[#434653]">{{ card.hint }}</span>
        <span
          class="mt-1 flex items-center gap-1 text-xs font-bold text-[#003d92] opacity-0 transition-opacity group-hover:opacity-100"
        >
          查看
          <span class="material-symbols-outlined" style="font-size: 14px">arrow_forward</span>
        </span>
      </button>
    </div>
  </section>
</template>
