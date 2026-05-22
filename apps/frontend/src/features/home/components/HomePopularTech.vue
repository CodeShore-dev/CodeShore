<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { toWan } from '../../../utils/format';
import { useHomeStore } from '../useHomeStore';

defineProps<{ loading: boolean }>();

const store = useHomeStore();
const router = useRouter();

const techCategory = ref<'all' | 'Language' | 'Framework'>('all');

const sortedTechStats = computed(() => {
  const list =
    techCategory.value === 'all'
      ? store.techStats
      : store.techStats.filter(t => t.category === techCategory.value);
  return [...list].sort((a, b) => b.job_count - a.job_count).slice(0, 10);
});

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}
</script>

<template>
  <section class="mt-10">
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div class="text-xs font-bold tracking-[0.18em] text-[#434653]">
        熱門語言 &amp; 框架
      </div>
      <div class="flex overflow-hidden rounded-lg border border-[#c9e7f7] text-xs">
        <button
          v-for="opt in [
            { v: 'all', l: '全部' },
            { v: 'Language', l: '語言' },
            { v: 'Framework', l: '框架' },
          ]"
          :key="opt.v"
          class="cursor-pointer px-3.5 py-1.5 font-bold transition-colors"
          :class="
            techCategory === opt.v
              ? 'bg-[#003d92] text-white'
              : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
          "
          @click="techCategory = opt.v as typeof techCategory"
        >
          {{ opt.l }}
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <div v-for="i in 10" :key="i" class="h-28 animate-pulse rounded-xl bg-[#d9f2ff]" />
    </div>
    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <button
        v-for="tech in sortedTechStats"
        :key="tech.keyword_group"
        class="group flex cursor-pointer flex-col rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        @click="goJobs({ tags: tech.keyword_group })"
      >
        <div class="mb-2 flex items-start justify-between gap-1">
          <span class="text-lg leading-tight font-black tracking-tight text-[#001f2a]">
            {{ tech.label }}
          </span>
          <span class="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#434653]">
            {{
              tech.category === 'Language'
                ? '語言'
                : tech.category === 'Framework'
                  ? '框架'
                  : '工具'
            }}
          </span>
        </div>
        <div
          class="tabular-nums leading-none font-black tracking-[-0.02em] text-[#003d92]"
          style="font-size: 1.5rem"
        >
          {{ tech.job_count.toLocaleString() }}
        </div>
        <div class="mt-0.5 text-[11px] text-[#434653]">個職缺</div>
        <div class="mt-2.5 border-t border-dashed border-[#c3c6d5] pt-2.5 text-xs text-[#434653]">
          <span class="font-bold text-[#9a4600]">月</span>
          {{ toWan(tech.avg_min_month) }}–{{ toWan(tech.avg_max_month) }}
        </div>
      </button>
    </div>
  </section>
</template>
