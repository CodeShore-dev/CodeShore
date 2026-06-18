<script lang="ts" setup>
import { ref, watch } from 'vue';

import HomeHandoff from '../components/HomeHandoff.vue';
import HomeHero from '../components/HomeHero.vue';
import HomeHighSalaryTech from '../components/HomeHighSalaryTech.vue';
import HomeHotCombos from '../components/HomeHotCombos.vue';
import HomePopularTech from '../components/HomePopularTech.vue';
import HomeSalaryBenchmark from '../components/HomeSalaryBenchmark.vue';
import HomeStatRow from '../components/HomeStatRow.vue';
import { useHomeStore } from '../useHomeStore';

const store = useHomeStore();
const loading = ref(true);

Promise.all([
  store.getMvSalaryTypeMedianRatio(),
  store.getJobCount(),
  store.getMvSalaryWeightedRatio(),
]).finally(() => {
  loading.value = false;
});

const popularTechs = ref<string[]>([]);
watch(
  () => store.keywordTechRanking.items,
  value => {
    popularTechs.value.push(
      ...value
        .filter(
          x =>
            !popularTechs.value.includes(x.keyword_group),
        )
        .map(x => x.keyword_group),
    );
  },
  { immediate: true },
);
</script>

<template>
  <div class="w-full">
    <HomeHero />
    <HomeStatRow :loading="loading" />
    <HomeSalaryBenchmark :loading="loading" />
    <HomePopularTech />
    <HomeHighSalaryTech :type="'year'" />
    <HomeHighSalaryTech :type="'month'" />
    <section class="mt-10">
      <div class="mb-2 flex items-baseline gap-3">
        <div
          class="text-xs font-bold tracking-[0.18em] text-[#434653]"
        >
          熱門技術組合
        </div>
        <RouterLink
          :to="{ name: 'techs-combos' }"
          class="flex items-center gap-0.5 text-xs font-bold text-[#003d92] transition-colors hover:text-[#001f2a]"
        >
          更多
          <span
            class="material-symbols-outlined"
            style="font-size: 14px"
          >
            arrow_forward
          </span>
        </RouterLink>
      </div>
      <div class="mb-4 text-lg font-black text-[#001f2a]">
        <span class="text-[#003d92]"
          >職缺裡最常同時出現的技術組合</span
        >
      </div>
      <HomeHotCombos
        v-for="tech in popularTechs"
        :key="tech"
        :tech
      />
    </section>
    <HomeHandoff />
  </div>
</template>
