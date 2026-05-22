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
    <!-- Page heading -->
    <div class="mb-8">
      <div class="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">● 公司列表 · COMPANIES</div>
      <div class="flex items-end justify-between gap-4">
        <h1 class="text-[2.25rem] font-black leading-tight tracking-[-0.03em] text-[#001f2a]">
          誰在徵人，<br class="sm:hidden">徵什麼
        </h1>
        <div class="flex shrink-0 items-center gap-3 pb-1">
          <button
            v-if="store.hasActiveFilters"
            class="cursor-pointer text-sm font-bold text-[#003d92]"
            @click="store.clearFilters()"
          >清除篩選</button>
          <span v-if="!store.loading" class="text-sm font-semibold text-[#434653]">
            共 {{ store.totalCount }} 間
          </span>
        </div>
      </div>
    </div>

    <div class="mb-6 flex flex-col gap-2 md:flex-row md:items-start flex-wrap">
      <div class="relative flex-1">
        <span class="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base! text-[#434653]/50">search</span>
        <input
          v-model="store.search"
          type="text"
          placeholder="搜尋公司名稱..."
          class="w-full rounded-xl border border-[#c3c6d5] bg-white py-2.5 pr-8 pl-9 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:border-[#003d92] focus:outline-none"
        />
        <button v-if="store.search" class="absolute top-1/2 right-3 flex -translate-y-1/2 cursor-pointer text-[#434653]/50 hover:text-[#001f2a]" @click="store.search = ''">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      <CompanyKeywordFilter />
    </div>

    <div v-if="store.loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 9" :key="i" class="h-44 animate-pulse rounded-[20px] bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]" />
    </div>

    <div v-else-if="store.companies.length === 0" class="py-24 text-center">
      <div class="mb-3 text-5xl font-black text-[#001f2a]/10">0</div>
      <p class="text-sm font-bold text-[#434653]">沒有符合條件的公司</p>
      <button
        v-if="store.hasActiveFilters"
        class="mt-4 cursor-pointer rounded-xl bg-[#003d92] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9] active:scale-95"
        @click="store.clearFilters()"
      >清除篩選條件</button>
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
