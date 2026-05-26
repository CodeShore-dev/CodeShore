<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

import SearchInput from '../../../components/SearchInput.vue';
import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useJobStore } from '../useJobStore';
import JobKeywordFilterPanel from './JobKeywordFilterPanel.vue';

const store = useJobStore();
const keywordStore = useKeywordStore();

// Debounced search for job title
const localSearchText = ref(store.searchText);
const debouncedSearchText = refDebounced(
  localSearchText,
  400,
);
watch(debouncedSearchText, val => {
  store.searchText = val;
});

// Debounced search for company name
const localCompanySearchText = ref(store.companySearchText);
const debouncedCompanySearchText = refDebounced(
  localCompanySearchText,
  400,
);
watch(debouncedCompanySearchText, val => {
  store.companySearchText = val;
});

// Salary amount with debounce
const salaryMultiplier = computed(() => {
  if (store.salaryAmountFilter.type === 'year')
    return 1_000_000;
  if (store.salaryAmountFilter.type === 'month')
    return 10_000;
  return 1;
});
const defaultLocalSalaryAmount = computed(() =>
  store.salaryAmountFilter.amount
    ? store.salaryAmountFilter.amount /
      salaryMultiplier.value
    : null,
);
const localSalaryAmount = ref<number | null>(
  defaultLocalSalaryAmount.value,
);
const debouncedSalaryAmount = refDebounced(
  localSalaryAmount,
  500,
);


const salaryUnitLabel = computed(() => {
  if (store.salaryAmountFilter.type === 'year')
    return '百萬';
  if (store.salaryAmountFilter.type === 'month')
    return '萬';
  return '';
});

watch(debouncedSalaryAmount, val => {
  store.salaryAmountFilter.amount =
    val !== null ? val * salaryMultiplier.value : null;
});

watch(
  () => store.salaryAmountFilter.type,
  () => {
    if (localSalaryAmount.value !== null) {
      store.salaryAmountFilter.amount =
        localSalaryAmount.value * salaryMultiplier.value;
    }
  },
);

function onSalaryAmountInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value;
  localSalaryAmount.value = raw ? Number(raw) : null;
}

function clearSalaryAmount(): void {
  localSalaryAmount.value = null;
  store.salaryAmountFilter.amount = null;
}

const hasActiveFilters = computed(
  () =>
    keywordStore.selectedTags.length > 0 ||
    keywordStore.keywordOperator !== 'and' ||
    store.salaryFilter !== 'none' ||
    store.salaryAmountFilter.type !== '' ||
    localSalaryAmount.value !== null ||
    !!store.searchText ||
    !!store.companySearchText ||
    store.selectedLocations.length > 0,
);

const locationSearch = ref('');
const filteredLocationGroups = computed(() => {
  const q = locationSearch.value.trim().toLowerCase();
  if (!q) return store.locationGroups;
  return store.locationGroups.filter(loc =>
    loc.location.toLowerCase().includes(q),
  );
});

function toggleLocation(location: string): void {
  const idx = store.selectedLocations.indexOf(location);
  if (idx === -1) {
    store.selectedLocations.push(location);
  } else {
    store.selectedLocations.splice(idx, 1);
  }
}

defineExpose({
  hasActiveFilters,
  localSearchText,
  localCompanySearchText,
  localSalaryAmount,
});
</script>

<template>
  <div class="space-y-6">
    <!-- Job search -->
    <section class="space-y-2">
      <SearchInput
        v-model="localSearchText"
        placeholder="搜尋職缺..."
      />
      <SearchInput
        v-model="localCompanySearchText"
        placeholder="搜尋公司名稱..."
      />
    </section>

    <!-- Keyword filter panel (includes keyword search, tabs, OperatorToggle, keyword list) -->
    <JobKeywordFilterPanel />

    <!-- Location filter -->
    <section>
      <div class="mb-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">地區</div>
      <div class="relative mb-3">
        <span class="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base! text-on-surface-variant">search</span>
        <input
          v-model="locationSearch"
          type="text"
          placeholder="搜尋地區..."
          class="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border py-2 pr-8 pl-9 text-sm font-bold focus:outline-none"
        />
        <button
          v-if="locationSearch"
          class="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer"
          @click="locationSearch = ''"
        >
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
      <div
        v-if="store.locationGroupsLoading"
        class="text-on-surface-variant text-xs"
      >載入中...</div>
      <div
        v-else
        class="flex max-h-60 flex-col gap-1 overflow-y-auto"
      >
        <span
          v-for="loc in filteredLocationGroups"
          :key="loc.location"
          class="flex w-full cursor-pointer items-center justify-between rounded px-4 py-2 text-sm font-bold"
          :class="
            store.selectedLocations.includes(loc.location)
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
          "
          @click="toggleLocation(loc.location)"
        >
          <span>{{ loc.location }}</span>
          <span class="flex items-center gap-1">
            <span
              v-if="store.selectedLocations.includes(loc.location)"
              class="material-symbols-outlined text-sm"
            >check</span>
            <span>{{ loc.count }}</span>
          </span>
        </span>
        <span
          v-if="!filteredLocationGroups.length && locationSearch"
          class="text-on-surface-variant px-4 py-2 text-sm"
        >沒有符合的地區</span>
      </div>
    </section>

    <!-- Salary filter: none / excluding / only -->
    <section>
      <div class="mb-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">面議薪資</div>
      <div class="flex overflow-hidden rounded-lg border border-[#c3c6d5]">
        <button
          v-for="option in [
            { value: 'none', label: '無' },
            { value: 'excluding', label: '排除面議' },
            { value: 'only', label: '只要面議' },
          ]"
          :key="option.value"
          class="flex-1 cursor-pointer py-1.5 text-sm font-bold transition-colors"
          :class="
            store.salaryFilter === option.value
              ? 'bg-[#003d92] text-white'
              : 'bg-white text-[#434653] hover:bg-[#f4faff]'
          "
          @click="store.salaryFilter = option.value as 'none' | 'excluding' | 'only'"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <!-- Salary amount filter: type toggle + amount input -->
    <section class="space-y-2">
      <div class="mb-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">薪資下限</div>
      <div class="flex overflow-hidden rounded-lg border border-[#c3c6d5]">
        <button
          v-for="option in [
            { value: '', label: '不限' },
            { value: 'month', label: '月薪' },
            { value: 'year', label: '年薪' },
          ]"
          :key="option.value"
          class="flex-1 cursor-pointer py-1.5 text-sm font-bold transition-colors"
          :class="
            store.salaryAmountFilter.type === option.value
              ? 'bg-[#003d92] text-white'
              : 'bg-white text-[#434653] hover:bg-[#f4faff]'
          "
          @click="store.salaryAmountFilter.type = option.value as 'month' | 'year' | ''"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="relative">
        <input
          type="number"
          :value="localSalaryAmount ?? ''"
          :placeholder="'最低薪資至少...'"
          :class="salaryUnitLabel ? 'pr-10' : 'pr-3'"
          :disabled="store.salaryAmountFilter.type === ''"
          class="w-full [appearance:textfield] rounded-lg border border-[#c3c6d5] bg-white py-2 pl-3 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:border-[#003d92] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          @input="onSalaryAmountInput"
        />
        <span
          v-if="salaryUnitLabel"
          class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-sm font-bold text-[#434653]"
        >{{ salaryUnitLabel }}</span>
        <button
          v-if="localSalaryAmount !== null"
          class="absolute top-1/2 right-8 flex -translate-y-1/2 cursor-pointer text-[#434653]/50 hover:text-[#434653]"
          @click="clearSalaryAmount"
        >
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </section>
  </div>
</template>

