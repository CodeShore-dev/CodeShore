import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { SupabaseFunction } from '@codeshore/data-types';

import { formatNumber } from '../../utils/format';
import {
  fetchJobCount,
  fetchSalaryRange,
  fetchSalaryStats,
  fetchTechComboStats,
  fetchTechStats,
} from './service';

export const useHomeStore = defineStore('home', () => {
  const salaryRange = ref<SupabaseFunction.SalaryRange>({
    avg_min_salary_month: 0,
    avg_max_salary_month: 0,
    avg_min_salary_year: 0,
    avg_max_salary_year: 0,
  });

  const jobCount = ref<SupabaseFunction.JobCount>({
    jobs: 0,
    month_salary_type_jobs: 0,
    year_salary_type_jobs: 0,
  });

  const techStats = ref<SupabaseFunction.TechStat[]>([]);
  const techComboStats = ref<SupabaseFunction.TechComboStat[]>([]);
  const salaryStats = ref<SupabaseFunction.SalaryStat[]>([]);

  const getSalaryRange = async () => {
    const res = await fetchSalaryRange();
    salaryRange.value = res;
  };

  const getJobCount = async () => {
    const res = await fetchJobCount();
    jobCount.value = res[0];
  };

  const getTechStats = async () => {
    techStats.value = await fetchTechStats();
  };

  const getTechComboStats = async () => {
    techComboStats.value = await fetchTechComboStats();
  };

  const getSalaryStats = async () => {
    salaryStats.value = await fetchSalaryStats();
  }

  const salaryBenchmarks = computed(() => {
    const yearSalary = salaryStats.value.find(stat => stat.salary_type === 'year');
    const monthSalary = salaryStats.value.find(stat => stat.salary_type === 'month');
    return {
    month: {
      均標: monthSalary?.avg_mark,
      高標: monthSalary?.high_mark,
      頂標: monthSalary?.top_mark,
    },
    year: {
      均標: yearSalary?.avg_mark,
      高標: yearSalary?.high_mark,
      頂標: yearSalary?.top_mark,
    },
  }
  });

  const jobCountText = computed(() => ({
    total: formatNumber(jobCount.value.jobs),
    month: formatNumber(jobCount.value.month_salary_type_jobs),
    year: formatNumber(jobCount.value.year_salary_type_jobs),
  }));

  return {
    jobCount,
    salaryRange,
    salaryBenchmarks,
    jobCountText,
    techStats,
    techComboStats,
    getSalaryRange,
    getJobCount,
    getTechStats,
    getTechComboStats,
    getSalaryStats
  };
});
