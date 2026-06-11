import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  SupabaseFunction,
  SupabaseView,
} from '@codeshore/data-types';

import { formatNumber } from '../../utils/format';
import useKeywordTechRanking from './composables/useKeywordTechRanking';
import {
  fetchJobCount,
  fetchMvSalaryTypeMedianRatio,
  fetchMvSalaryWeightedRatio,
} from './service';

export const useHomeStore = defineStore('home', () => {
  const selectedCategory = ref('language');

  const salaryTypeMedianRatio = ref<
    SupabaseView.MvSalaryTypeMedianRatio[]
  >([]);
  const salaryWeightedRatio = ref<
    SupabaseView.MvSalaryWeightedRatio[]
  >([]);

  const jobCount = ref<SupabaseFunction.JobCount>({
    jobs: 0,
    open_jobs: 0,
    month_salary_type_jobs: 0,
    year_salary_type_jobs: 0,
  });

  const getMvSalaryTypeMedianRatio = async () => {
    ({ result: salaryTypeMedianRatio.value } =
      await fetchMvSalaryTypeMedianRatio());
  };

  const getMvSalaryWeightedRatio = async () => {
    ({ result: salaryWeightedRatio.value } =
      await fetchMvSalaryWeightedRatio());
  };

  const getJobCount = async () => {
    const res = await fetchJobCount();
    jobCount.value = res[0];
  };

  const salaryBenchmarks = computed<
    Record<
      'year' | 'month',
      { median: number; high: number; top: number }
    >
  >(() => {
    const yearSalary = salaryTypeMedianRatio.value.find(
      stat => stat.salary_type === 'year',
    );
    const monthSalary = salaryTypeMedianRatio.value.find(
      stat => stat.salary_type === 'month',
    );
    return {
      month: {
        median: monthSalary?.median_mark ?? 0,
        high: monthSalary?.high_mark ?? 0,
        top: monthSalary?.top_mark ?? 0,
      },
      year: {
        median: yearSalary?.median_mark ?? 0,
        high: yearSalary?.high_mark ?? 0,
        top: yearSalary?.top_mark ?? 0,
      },
    };
  });

  const jobCountText = computed(() => ({
    total: formatNumber(jobCount.value.jobs),
    open: formatNumber(jobCount.value.open_jobs),
    month: formatNumber(
      jobCount.value.month_salary_type_jobs,
    ),
    year: formatNumber(
      jobCount.value.year_salary_type_jobs,
    ),
  }));

  const keywordTechRanking = useKeywordTechRanking();

  return {
    jobCount,
    salaryTypeMedianRatio,
    salaryBenchmarks,
    jobCountText,
    selectedCategory,
    keywordTechRanking,
    getMvSalaryTypeMedianRatio,
    getMvSalaryWeightedRatio,
    getJobCount,
  };
});
