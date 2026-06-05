<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { toWan } from '../../../utils/format';
import { CATEGORY_LABEL_MAP } from '../../keyword/useKeywordStore';
import { useHomeStore } from '../useHomeStore';

const store = useHomeStore();
const router = useRouter();

const selectedCategory = ref('language');

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}

watch(
  selectedCategory,
  value => {
    store.getMvKeywordGroupRanking(value);
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
        熱門關鍵字
      </div>
      <div
        class="flex flex-wrap overflow-hidden rounded-lg border border-[#c9e7f7] text-xs"
      >
        <button
          v-for="opt in Object.entries(
            CATEGORY_LABEL_MAP,
          ).map(([key, value]) => ({
            value: key,
            label: value,
          }))"
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
      v-if="store.mvKeywordGroupRankingLoading"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <div
        v-for="i in 5"
        :key="i"
        class="h-28 animate-pulse rounded-xl bg-[#d9f2ff]"
      />
    </div>
    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <button
        v-for="item in store.mvKeywordGroupRanking"
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
          class="mt-2.5 flex h-full justify-between border-t border-dashed border-[#c3c6d5] pt-2.5 text-xs text-[#434653]"
        >
          <div class="flex">
            <div class="flex flex-col gap-1 pr-2">
              <div class="h-3 w-3"></div>
              <div
                v-if="
                  item.month_median_avg &&
                  item.month_pr75_avg &&
                  item.month_pr88_avg
                "
                class="font-bold text-[#9a4600]"
              >
                月
              </div>
              <div
                v-if="
                  item.year_median_avg &&
                  item.year_pr75_avg &&
                  item.year_pr88_avg
                "
                class="font-bold text-[#9a4600]"
              >
                年
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <div class="grid grid-cols-3 gap-1">
                <div
                  v-for="item in ['PR50', 'PR75', 'PR88']"
                  class="font-mono text-[10px] tracking-widest text-[#434653]"
                >
                  {{ item }}
                </div>
              </div>
              <div
                v-if="
                  item.month_median_avg &&
                  item.month_pr75_avg &&
                  item.month_pr88_avg
                "
                class="grid grid-cols-3 gap-1"
              >
                <div
                  v-for="avg in [
                    item.month_median_avg,
                    item.month_pr75_avg,
                    item.month_pr88_avg,
                  ]"
                  class="tabular-nums"
                >
                  {{ toWan(avg) }}
                </div>
              </div>
              <div
                v-if="
                  item.year_median_avg &&
                  item.year_pr75_avg &&
                  item.year_pr88_avg
                "
                class="grid grid-cols-3 gap-1"
              >
                <div
                  v-for="avg in [
                    item.year_median_avg,
                    item.year_pr75_avg,
                    item.year_pr88_avg,
                  ]"
                  class="tabular-nums"
                >
                  {{ toWan(avg) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <span
          class="mt-1 flex items-end justify-end gap-1 text-xs font-bold text-[#003d92]"
        >
          前往
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

