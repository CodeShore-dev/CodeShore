import { refDebounced } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { fetchCompanies } from './service';

const PAGE_SIZE = 18;

export const useCompanyStore = defineStore('company', () => {
  const companies = ref<SupabaseView.CompanyView[]>([]);
  const totalCount = ref(0);
  const currentPage = ref(1);
  const loading = ref(false);

  // Filters
  const search = ref('');
  const debouncedSearch = refDebounced(search, 400);
  const selectedKeywordGroups = ref<string[]>([]);
  const keywordGroupOperator = ref<'and' | 'or'>('and');

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)),
  );

  const hasActiveFilters = computed(
    () =>
      !!search.value.trim() ||
      selectedKeywordGroups.value.length > 0,
  );

  const buildWhere = () => {
    const conditions: Record<string, unknown> = {};
    if (debouncedSearch.value.trim()) {
      conditions.company_name = {
        ilike: `%${debouncedSearch.value.trim()}%`,
      };
    }
    if (selectedKeywordGroups.value.length > 0) {
      const op =
        keywordGroupOperator.value === 'or' ? 'ov' : 'cs';
      conditions.keyword_groups = {
        [op]: `{${selectedKeywordGroups.value.join(',')}}`,
      };
    }
    return Object.keys(conditions).length > 0
      ? JSON.stringify(conditions)
      : undefined;
  };

  const loadCompanies = async (page = currentPage.value) => {
    loading.value = true;
    currentPage.value = page;
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    try {
      const { result, count } = await fetchCompanies({
        from,
        to,
        where: buildWhere(),
      });
      companies.value = result;
      totalCount.value = count;
    } finally {
      loading.value = false;
    }
  };


  const toggleKeywordGroup = (kg: string) => {
    const idx = selectedKeywordGroups.value.indexOf(kg);
    if (idx === -1) {
      selectedKeywordGroups.value.push(kg);
    } else {
      selectedKeywordGroups.value.splice(idx, 1);
    }
  };

  const clearFilters = () => {
    search.value = '';
    selectedKeywordGroups.value = [];
    keywordGroupOperator.value = 'and';
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value)
      loadCompanies(page);
  };
  const prevPage = () => goToPage(currentPage.value - 1);
  const nextPage = () => goToPage(currentPage.value + 1);

  watch(
    [debouncedSearch, selectedKeywordGroups, keywordGroupOperator],
    () => loadCompanies(1),
    { deep: true },
  );

  return {
    companies,
    totalCount,
    currentPage,
    totalPages,
    loading,
    search,
    selectedKeywordGroups,
    keywordGroupOperator,
    hasActiveFilters,
    loadCompanies,
    toggleKeywordGroup,
    clearFilters,
    goToPage,
    prevPage,
    nextPage,
  };
});
