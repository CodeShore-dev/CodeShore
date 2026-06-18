<script setup lang="ts">
import { computed } from 'vue';

import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useJobStore } from '../useJobStore';

type Emits = { (e: 'clearAll'): void };
const emit = defineEmits<Emits>();

const store = useJobStore();
const keywordStore = useKeywordStore();

type Chip = {
  key: string;
  group: string;
  label: string;
  kind:
    | 'include'
    | 'exclude'
    | 'operator'
    | 'salary'
    | 'location'
    | 'search'
    | 'company';
  remove: () => void;
};

const groupLabelMap = computed<Record<string, string>>(() =>
  Object.fromEntries(
    keywordStore.keywordGroups.map(g => [
      g.keyword_group,
      g.label,
    ]),
  ),
);
function kwLabel(tag: string): string {
  return groupLabelMap.value[tag] ?? tag;
}

const salaryAmountLabel = computed<string | null>(() => {
  const { type, amount } = store.salaryAmountFilter;
  if (!type) return null;
  const typeLabel = type === 'year' ? '年薪' : '月薪';
  if (amount === null) return `薪資類型：${typeLabel}`;
  const unit = type === 'year' ? '百萬' : '萬';
  const mult = type === 'year' ? 1_000_000 : 10_000;
  return `${typeLabel} ≥ ${amount / mult}${unit}`;
});

const chips = computed<Chip[]>(() => {
  const list: Chip[] = [];

  if (store.searchText) {
    list.push({
      key: 'search',
      group: '職缺',
      label: store.searchText,
      kind: 'search',
      remove: () => (store.searchText = ''),
    });
  }

  if (store.companySearchText) {
    list.push({
      key: 'company',
      group: '公司',
      label: store.companySearchText,
      kind: 'company',
      remove: () => (store.companySearchText = ''),
    });
  }

  for (const tag of keywordStore.selectedTags) {
    list.push({
      key: `inc-${tag}`,
      group: '技能',
      label: kwLabel(tag),
      kind: 'include',
      remove: () =>
        (keywordStore.selectedTags =
          keywordStore.selectedTags.filter(t => t !== tag)),
    });
  }

  if (
    keywordStore.selectedTags.length > 1 &&
    keywordStore.keywordOperator === 'or'
  ) {
    list.push({
      key: 'operator',
      group: '技能邏輯',
      label: '符合任一',
      kind: 'operator',
      remove: () => (keywordStore.keywordOperator = 'and'),
    });
  }

  for (const tag of keywordStore.excludedTags) {
    list.push({
      key: `exc-${tag}`,
      group: '排除技能',
      label: kwLabel(tag),
      kind: 'exclude',
      remove: () =>
        (keywordStore.excludedTags =
          keywordStore.excludedTags.filter(t => t !== tag)),
    });
  }

  for (const loc of store.selectedLocations) {
    list.push({
      key: `loc-${loc}`,
      group: '地區',
      label: loc,
      kind: 'location',
      remove: () =>
        (store.selectedLocations =
          store.selectedLocations.filter(l => l !== loc)),
    });
  }

  if (store.salaryFilter !== 'none') {
    list.push({
      key: 'salaryFilter',
      group: '面議',
      label:
        store.salaryFilter === 'excluding'
          ? '排除面議'
          : '只要面議',
      kind: 'salary',
      remove: () => (store.salaryFilter = 'none'),
    });
  }

  if (salaryAmountLabel.value) {
    list.push({
      key: 'salaryAmount',
      group: '薪資',
      label: salaryAmountLabel.value,
      kind: 'salary',
      remove: () => {
        store.salaryAmountFilter.type = '';
        store.salaryAmountFilter.amount = null;
      },
    });
  }

  return list;
});

const chipClass: Record<Chip['kind'], string> = {
  include: 'bg-[#003d92] text-white',
  exclude: 'bg-[#ba1a1a] text-white',
  operator: 'bg-[#003d92]/15 text-[#003d92]',
  salary: 'bg-[#003d92]/15 text-[#003d92]',
  location: 'bg-[#003d92]/15 text-[#003d92]',
  search: 'bg-[#003d92]/15 text-[#003d92]',
  company: 'bg-[#003d92]/15 text-[#003d92]',
};
</script>

<template>
  <section
    v-if="chips.length"
    class="mb-4 rounded-xl bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
  >
    <div class="mb-2 flex items-center justify-between">
      <span
        class="text-[10px] font-bold tracking-[0.15em] text-[#434653]"
      >
        目前篩選條件・{{ chips.length }} 項
      </span>
      <button
        class="cursor-pointer text-xs font-bold text-[#003d92] hover:underline"
        @click="emit('clearAll')"
      >
        清除全部
      </button>
    </div>
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="chip in chips"
        :key="chip.key"
        class="flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs font-bold"
        :class="chipClass[chip.kind]"
      >
        <span class="opacity-60">{{ chip.group }}</span>
        <span>{{ chip.label }}</span>
        <button
          class="flex cursor-pointer items-center rounded transition-opacity hover:opacity-70"
          :title="`移除 ${chip.group}：${chip.label}`"
          @click="chip.remove"
        >
          <span
            class="material-symbols-outlined text-sm! leading-none"
            >close</span
          >
        </button>
      </span>
    </div>
  </section>
</template>
