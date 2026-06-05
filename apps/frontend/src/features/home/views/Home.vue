<script lang="ts" setup>
import { ref } from 'vue';

import { useHomeStore } from '../useHomeStore';
import HomeHandoff from '../components/HomeHandoff.vue';
import HomeHero from '../components/HomeHero.vue';
import HomeHotCombos from '../components/HomeHotCombos.vue';
import HomePopularTech from '../components/HomePopularTech.vue';
import HomeSalaryBenchmark from '../components/HomeSalaryBenchmark.vue';
import HomeStatRow from '../components/HomeStatRow.vue';

const store = useHomeStore();
const loading = ref(true);

Promise.all([
  store.getMvSalaryTypeMedianRatio(),
  store.getJobCount(),
  store.getMvSalaryWeightedRatio(),
]).finally(() => {
  loading.value = false;
});
</script>

<template>
  <div class="w-full">
    <HomeHero />
    <HomeStatRow :loading="loading" />
    <HomeSalaryBenchmark :loading="loading" />
    <HomePopularTech />
    <HomeHotCombos :loading="loading" />
    <HomeHandoff />
  </div>
</template>
