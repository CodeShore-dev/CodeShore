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
  fetchMvSalaryTypeMedianRatio,
  fetchMvSalaryWeightedRatio,
} from './service';

export const useHomeStore = defineStore('home', () => {
  const mvKeywordGroupRankingLoading = ref(false);

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

  const mvKeywordGroupRanking = ref<
    SupabaseView.MvKeywordGroupRanking[]
  >([]);

  const getMvSalaryTypeMedianRatio = async () => {
    salaryTypeMedianRatio.value =
      await fetchMvSalaryTypeMedianRatio();
  };

  const getMvSalaryWeightedRatio = async () => {
    salaryWeightedRatio.value =
      await fetchMvSalaryWeightedRatio();
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
        to: 4,
        where: JSON.stringify({
          category: { eq: category },
        }),
        orders: 'job_count:desc',
      }));
    mvKeywordGroupRankingLoading.value = false;
  };

  const salaryBenchmarks = computed(() => {
    const yearSalary = salaryTypeMedianRatio.value.find(
      stat => stat.salary_type === 'year',
    );
    const monthSalary = salaryTypeMedianRatio.value.find(
      stat => stat.salary_type === 'month',
    );
    return {
      month: {
        均標: monthSalary?.median_mark,
        高標: monthSalary?.high_mark,
        頂標: monthSalary?.top_mark,
      },
      year: {
        均標: yearSalary?.median_mark,
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
    salaryTypeMedianRatio,
    salaryBenchmarks,
    jobCountText,
    mvKeywordGroupRanking,
    mvKeywordGroupRankingLoading,
    getMvSalaryTypeMedianRatio,
    getMvSalaryWeightedRatio,
    getJobCount,
    getMvKeywordGroupRanking,
  };
});
