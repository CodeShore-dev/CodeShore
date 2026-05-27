<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { toWan } from '../../../utils/format';
import { useHomeStore } from '../useHomeStore';

defineProps<{ loading: boolean }>();

const store = useHomeStore();
const router = useRouter();

const sortedComboStats = computed(() =>
  [...store.techComboStats].sort((a, b) => b.job_count - a.job_count),
);

const topCombo = computed(() => sortedComboStats.value[0]);
const smallCombos = computed(() => sortedComboStats.value.slice(1, 5));

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}
</script>

<template>
  <section class="mt-10">
    <div class="mb-2 text-xs font-bold tracking-[0.18em] text-[#434653]">
      熱門技術組合
    </div>
    <div class="mb-4 text-lg font-black text-[#001f2a]">
      <span class="text-[#003d92]">職缺裡最常同時出現的技術組合</span>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-3 md:[grid-template-columns:1.4fr_1fr_1fr]">
      <div class="col-span-2 h-60 animate-pulse rounded-xl bg-[#d9f2ff] md:col-span-1 md:row-span-2 md:h-72" />
      <div v-for="i in 4" :key="i" class="h-32 animate-pulse rounded-xl bg-[#d9f2ff]" />
    </div>

    <div
      v-else-if="topCombo"
      class="grid gap-3 grid-cols-2 md:[grid-template-columns:1.4fr_1fr_1fr]"
    >
      <!-- Hero combo (#1) -->
      <button
        class="col-span-2 flex cursor-pointer flex-col justify-between rounded-xl bg-[#001f2a] p-6 text-left text-white transition-all hover:opacity-95 active:scale-[0.98] md:col-span-1 md:row-span-2"
        style="min-height: clamp(200px, 50vw, 280px)"
        @click="goJobs({ tags: `${topCombo.tech1},${topCombo.tech2}` })"
      >
        <div>
          <div class="mb-4 font-mono text-[11px] tracking-[0.15em] text-white/50">
            #01 · 市場標配
          </div>
          <div
            class="leading-none font-black tracking-[-0.03em]"
            style="font-size: clamp(1.75rem, 7vw, 3.25rem)"
          >
            {{ topCombo.tech1_label }}<br />
            <span class="text-[#fd7700]">+</span>
            {{ topCombo.tech2_label }}
          </div>
          <p class="mt-4 max-w-80 text-sm leading-relaxed text-white/75">
            市場上最不陌生的組合。掌握這兩個，{{ topCombo.job_count.toLocaleString() }} 個職缺都是你的舞台。
          </p>
        </div>
        <div class="mt-4 flex items-end justify-between">
          <div>
            <div
              class="tabular-nums leading-none font-black tracking-[-0.02em] text-[#fd7700]"
              style="font-size: clamp(1.5rem, 5vw, 2.5rem)"
            >
              {{ topCombo.job_count.toLocaleString() }}
            </div>
            <div class="mt-0.5 text-[11px] text-white/50">個職缺</div>
          </div>
          <div class="text-right">
            <div class="tabular-nums text-xl font-black">
              {{ toWan(topCombo.avg_min_month) }}–{{ toWan(topCombo.avg_max_month) }}
            </div>
            <div class="text-[11px] text-white/50">月薪</div>
          </div>
        </div>
      </button>

      <!-- Small combos (#2–5) -->
      <button
        v-for="(combo, i) in smallCombos"
        :key="`${combo.tech1}+${combo.tech2}`"
        class="flex cursor-pointer flex-col justify-between rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        style="min-height: 130px"
        @click="goJobs({ tags: `${combo.tech1},${combo.tech2}` })"
      >
        <div class="font-mono text-[10px] tracking-[0.15em] text-[#434653]">
          #0{{ i + 2 }}
        </div>
        <div
          class="mt-2 leading-tight font-black tracking-[-0.02em] text-[#001f2a]"
          style="font-size: 1.375rem"
        >
          {{ combo.tech1_label }}
          <span class="text-[#fd7700]">+</span>
          {{ combo.tech2_label }}
        </div>
        <div class="mt-2 flex items-end justify-between">
          <div>
            <div
              class="tabular-nums leading-none font-black text-[#003d92]"
              style="font-size: 1.375rem"
            >
              {{ combo.job_count.toLocaleString() }}
            </div>
            <div class="text-[10px] text-[#434653]">個職缺</div>
          </div>
          <div class="tabular-nums text-right text-[11px] font-bold text-[#434653]">
            {{ toWan(combo.avg_min_month) }}–{{ toWan(combo.avg_max_month) }}
          </div>
        </div>
      </button>
    </div>
  </section>
</template>
