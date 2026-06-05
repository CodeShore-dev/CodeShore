import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  SupabaseFunction,
  SupabaseView,
} from '@codeshore/data-types';

import { formatNumber } from '../../utils/format';
import {
  fetchJobCount,
  fetchMvKeywordGroupRanking,
  fetchSalaryRange,
  fetchSalaryStats,
  fetchTechComboStats,
} from './service';

export const useHomeStore = defineStore('home', () => {
  const mvKeywordGroupRankingLoading = ref(false);

  const salaryRange = ref<SupabaseFunction.SalaryRange>({
    avg_min_salary_month: 0,
    avg_max_salary_month: 0,
    avg_min_salary_year: 0,
    avg_max_salary_year: 0,
  });

  const jobCount = ref<SupabaseFunction.JobCount>({
    jobs: 0,
    open_jobs: 0,
    month_salary_type_jobs: 0,
    year_salary_type_jobs: 0,
  });

  const mvKeywordGroupRanking = ref<
    SupabaseView.MvKeywordGroupRanking[]
  >([]);
  const techComboStats = ref<
    SupabaseFunction.TechComboStat[]
  >([]);
  const salaryStats = ref<SupabaseFunction.SalaryStat[]>(
    [],
  );

  const getSalaryRange = async () => {
    const res = await fetchSalaryRange();
    salaryRange.value = res;
  };

  const getJobCount = async () => {
    const res = await fetchJobCount();
    jobCount.value = res[0];
  };

  const getMvKeywordGroupRanking = async (
    category?: string,
  ) => {
    mvKeywordGroupRankingLoading.value = true;
    ({ result: mvKeywordGroupRanking.value } =
      await fetchMvKeywordGroupRanking({
        from: 0,
        to: 15,
        where: category && category !== 'all'
          ? JSON.stringify({ category: { eq: category } })
          : undefined,
        orders: 'job_count:desc',
      }));
    mvKeywordGroupRankingLoading.value = false;
  };

  const getTechComboStats = async () => {
    techComboStats.value = await fetchTechComboStats();
  };

  const getSalaryStats = async () => {
    salaryStats.value = await fetchSalaryStats();
  };

  const salaryBenchmarks = computed(() => {
    const yearSalary = salaryStats.value.find(
      stat => stat.salary_type === 'year',
    );
    const monthSalary = salaryStats.value.find(
      stat => stat.salary_type === 'month',
    );
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

  return {
    jobCount,
    salaryRange,
    salaryBenchmarks,
    jobCountText,
    mvKeywordGroupRanking,
    techComboStats,
    mvKeywordGroupRankingLoading,
    getSalaryRange,
    getJobCount,
    getMvKeywordGroupRanking,
    getTechComboStats,
    getSalaryStats,
  };
});
