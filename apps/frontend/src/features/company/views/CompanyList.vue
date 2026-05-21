<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useCompanyStore } from '../useCompanyStore';
import CompanyCard from '../components/CompanyCard.vue';
import CompanyKeywordFilter from '../components/CompanyKeywordFilter.vue';
import Pagination from '../../../components/Pagination.vue';

const store = useCompanyStore();
const keywordStore = useKeywordStore();
const router = useRouter();

const categoryLabelMap = computed(() =>
  Object.fromEntries(keywordStore.tabs.map(t => [t.value, t.label])),
);

store.loadCompanies();

function goToJobs(companyName: string): void {
  router.push({ name: 'jobs', query: { company: companyName } });
}
</script>

<template>
  <div class="w-full">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-on-surface text-2xl font-black tracking-tight">公司列表</h1>
      <div class="flex items-center gap-3">
        <button
          v-if="store.hasActiveFilters"
          class="text-primary cursor-pointer text-sm font-bold"
          @click="store.clearFilters()"
        >清除篩選</button>
        <span v-if="!store.loading" class="text-on-surface-variant text-sm font-semibold">
          共 {{ store.totalCount }} 間公司
        </span>
      </div>
    </div>

    <div class="mb-6 flex flex-col gap-2 md:flex-row md:items-start flex-wrap">
      <div class="relative flex-1">
        <span class="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!">search</span>
        <input
          v-model="store.search"
          type="text"
          placeholder="搜尋公司名稱..."
          class="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-xl border py-2.5 pr-8 pl-9 text-sm font-bold focus:outline-none"
        />
        <button v-if="store.search" class="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-3 flex -translate-y-1/2 cursor-pointer" @click="store.search = ''">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      <CompanyKeywordFilter />
    </div>

    <div v-if="store.loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 9" :key="i" class="bg-surface-container-low h-40 animate-pulse rounded-2xl" />
    </div>

    <div v-else-if="store.companies.length === 0" class="text-on-surface-variant py-20 text-center text-sm font-semibold">
      沒有符合條件的公司
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CompanyCard
          v-for="company in store.companies"
          :key="company.company_id"
          :company="company"
          :keyword-groups="keywordStore.keywordGroups"
          :category-label-map="categoryLabelMap"
          :selected-keyword-groups="store.selectedKeywordGroups"
          @click="goToJobs"
        />
      </div>
      <Pagination
        :current-page="store.currentPage"
        :total-pages="store.totalPages"
        @update:current-page="store.goToPage($event)"
      />
    </template>
  </div>
</template>
