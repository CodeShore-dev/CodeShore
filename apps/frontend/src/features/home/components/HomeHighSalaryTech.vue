<script lang="ts" setup>
import KeywordTechRankingCardList from '../../../components/KeywordTechRankingCardList.vue';
import { toWanInt } from '../../../utils/format';
import useKeywordTechRanking from '../composables/useKeywordTechRanking';
import { useHomeStore } from '../useHomeStore';

type Props = {
  type: 'month' | 'year';
};

const props = withDefaults(defineProps<Props>(), {});

const homeStore = useHomeStore();

const titleMap = {
  month: '高薪技術(月薪)',
  year: '高薪技術(年薪)',
};

const { items, getItems, loading } = useKeywordTechRanking({
  where: {
    $or: {
      [`${props.type}_median_avg`]: {
        gte: homeStore.salaryBenchmarks[props.type].median,
      },
    },
  },
  orders: `${props.type}_median_avg:desc`,
});
</script>

<template>
  <KeywordTechRankingCardList
    :title="titleMap[props.type]"
    :items
    :loading
    :get-items
    :more-to="{
      name: 'techs',
      query: { mode: `salary-${props.type}` },
    }"
  >
    <template #metric="{ item }">
      <div class="flex flex-col gap-1.5">
        <div
          class="flex items-center justify-between gap-1 text-lg"
        >
          <span
            class="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
          >
            {{ toWanInt(item[`${props.type}_median_avg`]) }}
            <span
              class="text-[0.875rem] font-black text-[#434653]"
            >
              萬
            </span>
          </span>
          <span
            class="flex items-baseline gap-1 text-[11px] font-bold text-[#434653]"
          >
            <span
              class="font-mono text-[10px] tracking-widest"
            >
              PR50
            </span>
          </span>
        </div>
        <div
          class="flex items-center justify-between gap-1 text-sm"
        >
          <span
            class="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
          >
            {{ toWanInt(item[`${props.type}_pr75_avg`]) }}
            <span
              class="text-[0.875rem] font-black text-[#434653]"
            >
              萬
            </span>
          </span>
          <span
            class="flex items-baseline gap-1 text-[11px] font-bold text-[#434653]"
          >
            <span
              class="font-mono text-[10px] tracking-widest"
            >
              PR75
            </span>
          </span>
        </div>
        <div
          class="flex items-center justify-between gap-1 text-xs"
        >
          <span
            class="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
          >
            {{ toWanInt(item[`${props.type}_pr88_avg`]) }}
            <span
              class="text-[0.875rem] font-black text-[#434653]"
            >
              萬
            </span>
          </span>
          <span
            class="flex items-baseline gap-1 text-[11px] font-bold text-[#434653]"
          >
            <span
              class="font-mono text-[10px] tracking-widest"
            >
              PR88
            </span>
          </span>
        </div>
      </div>
    </template>
  </KeywordTechRankingCardList>
</template>
