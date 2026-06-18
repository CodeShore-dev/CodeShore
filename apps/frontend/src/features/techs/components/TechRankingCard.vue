<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { SupabaseView } from '@codeshore/data-types';

import TechIcon from '../../../components/TechIcon.vue';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWanInt } from '../../../utils/format';
import type { RankingMode } from '../composables/useTechRanking';

const props = defineProps<{
  item: SupabaseView.MvKeywordGroupRanking;
  rank: number;
  mode: RankingMode;
}>();

const router = useRouter();

const isSalary = computed(() => props.mode !== 'popular');
const salaryType = computed<'year' | 'month'>(() =>
  props.mode === 'salary-month' ? 'month' : 'year',
);

const salaryRows = computed(() => {
  const t = salaryType.value;
  return [
    { label: 'PR50', value: props.item[`${t}_median_avg`] },
    { label: 'PR75', value: props.item[`${t}_pr75_avg`] },
    { label: 'PR88', value: props.item[`${t}_pr88_avg`] },
  ];
});

function goJobs() {
  router.push({
    name: 'jobs',
    query: { tags: props.item.keyword_group },
  });
}
</script>

<template>
  <button
    class="group flex cursor-pointer flex-col rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
    @click="goJobs"
  >
    <div class="mb-2 flex flex-col items-start gap-1">
      <div
        class="font-mono text-[10px] tracking-[0.15em] text-[#434653]"
      >
        #{{ rank }}
      </div>
      <div class="flex items-center gap-2">
        <TechIcon
          :slugs="item.icon_slugs"
          :label="item.label"
        />
        <span
          class="text-lg leading-tight font-black tracking-tight text-[#001f2a]"
        >
          {{ item.label }}
        </span>
      </div>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="tag in item.tags"
          :key="tag"
          class="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-1 text-[10px] font-bold text-[#434653]"
        >
          {{ TAG_LABEL_MAP[tag] ?? tag }}
        </span>
      </div>
    </div>

    <div class="h-full">
      <div v-if="isSalary" class="flex flex-col gap-1.5">
        <div
          v-for="row in salaryRows"
          :key="row.label"
          class="flex items-center justify-between gap-1"
        >
          <span
            class="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
            style="font-size: 1.125rem"
          >
            {{ toWanInt(row.value) }}
            <span
              class="text-[0.875rem] font-black text-[#434653]"
              >萬</span
            >
          </span>
          <span
            class="font-mono text-[10px] tracking-widest text-[#434653]"
          >
            {{ row.label }}
          </span>
        </div>
      </div>
      <template v-else>
        <div
          class="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
          style="font-size: 1.5rem"
        >
          {{ item.job_count.toLocaleString() }}
        </div>
        <div class="mt-0.5 text-[11px] text-[#434653]">
          個職缺
        </div>
      </template>
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
</template>
