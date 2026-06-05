<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { toWan } from '../../../utils/format';
import { CATEGORY_LABEL_MAP } from '../../keyword/useKeywordStore';
import { useHomeStore } from '../useHomeStore';

defineProps<{ loading: boolean }>();

const store = useHomeStore();
const router = useRouter();

const selectedCategory = ref('all');

const mvKeywordGroupRanking = computed(() => {
  const list =
    selectedCategory.value === 'all'
      ? store.mvKeywordGroupRanking
      : store.mvKeywordGroupRanking.filter(
          t => t.category === selectedCategory.value,
        );
  return [...list].slice(0, 15);
});

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}

watch(selectedCategory, value => {
  store.getMvKeywordGroupRanking(value);
});
</script>

<template>
  <section class="mt-10">
    <div
      class="mb-4 flex flex-wrap items-baseline justify-between gap-2"
    >
      <div
        class="text-xs font-bold tracking-[0.18em] text-[#434653]"
      >
        熱門技術
      </div>
      <div
        class="flex flex-wrap overflow-hidden rounded-lg border border-[#c9e7f7] text-xs"
      >
        <button
          v-for="opt in [
            { value: 'all', label: '全部' },
            ...Object.entries(CATEGORY_LABEL_MAP).map(
              ([key, value]) => ({
                value: key,
                label: value,
              }),
            ),
          ]"
          :key="opt.value"
          class="md:h-auo h-10 w-[33.3%] cursor-pointer px-3.5 py-1.5 font-bold transition-colors md:w-auto"
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
      v-if="loading || store.mvKeywordGroupRankingLoading"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <div
        v-for="i in 15"
        :key="i"
        class="h-28 animate-pulse rounded-xl bg-[#d9f2ff]"
      />
    </div>
    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <button
        v-for="item in mvKeywordGroupRanking"
        :key="item.keyword_group"
        class="group flex cursor-pointer flex-col rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        @click="goJobs({ tags: item.keyword_group })"
      >
        <div
          class="mb-2 flex items-start justify-between gap-1"
        >
          <span
            class="text-lg leading-tight font-black tracking-tight text-[#001f2a]"
          >
            {{ item.label }}
          </span>
          <span
            class="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#434653]"
          >
            {{ CATEGORY_LABEL_MAP[item.category] }}
          </span>
        </div>
        <div
          class="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
          style="font-size: 1.5rem"
        >
          {{ item.job_count.toLocaleString() }}
        </div>
        <div class="mt-0.5 text-[11px] text-[#434653]">
          個職缺
        </div>
        <div
          class="mt-2.5 flex justify-between border-t border-dashed border-[#c3c6d5] pt-2.5 text-xs text-[#434653]"
        >
          <div>
            <div
              v-if="
                item.avg_min_month && item.avg_min_month
              "
            >
              <span class="font-bold text-[#9a4600]"
                >月</span
              >
              {{ toWan(item.avg_min_month) }}–{{
                toWan(item.avg_max_month)
              }}
            </div>
            <div
              v-if="item.avg_min_year && item.avg_max_year"
            >
              <span class="font-bold text-[#9a4600]"
                >年</span
              >
              {{ toWan(item.avg_min_year) }}–{{
                toWan(item.avg_max_year)
              }}
            </div>
          </div>
          <span
            class="mt-1 flex items-center gap-1 text-xs font-bold text-[#003d92]"
          >
            前往查看
            <span
              class="material-symbols-outlined"
              style="font-size: 14px"
            >
              arrow_forward
            </span>
          </span>
        </div>
      </button>
    </div>
  </section>
</template>

