<script setup lang="ts">
import { computed, ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import OperatorToggle from '../../../components/OperatorToggle.vue';
import SearchInput from '../../../components/SearchInput.vue';
import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useCompanyStore } from '../useCompanyStore';

type KeywordGroupView = SupabaseView.KeywordGroupView;

const companyStore = useCompanyStore();
const keywordStore = useKeywordStore();

const kgExpanded = ref(false);
const kgSearch = ref('');
const selectedKgCategory = ref('');

keywordStore.getKeywordGroupView();
keywordStore.getKeywordGroupCategories().then(() => {
  selectedKgCategory.value =
    keywordStore.tabs[0]?.value ?? '';
});

const kgTabs = computed(() => keywordStore.tabs);

const kgMappings = computed(() => {
  const q = kgSearch.value.trim().toLowerCase();
  const all = q
    ? keywordStore.keywordGroups.filter(
        (g: KeywordGroupView) =>
          g.keyword_group.toLowerCase().includes(q),
      )
    : keywordStore.keywordGroups.filter(
        (g: KeywordGroupView) => {
          if (!selectedKgCategory.value) {
            const knownCategories = keywordStore.tabs
              .map((t: { value: string }) => t.value)
              .filter(Boolean);
            return !knownCategories.includes(
              g.category ?? '',
            );
          }
          return g.category === selectedKgCategory.value;
        },
      );
  return all;
});

type Operator = 'and' | 'or';

function onOperatorChange(value: Operator): void {
  companyStore.keywordGroupOperator = value;
}
</script>

<template>
  <button
    class="bg-surface-container border-surface-container-highest text-on-surface-variant hover:text-on-surface flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors"
    @click="kgExpanded = !kgExpanded"
  >
    <span class="material-symbols-outlined text-sm"
      >tag</span
    >
    技術篩選
    <span
      v-if="companyStore.selectedKeywordGroups.length"
      class="bg-primary text-on-primary rounded-full px-1.5 py-0.5 text-sm"
    >
      {{ companyStore.selectedKeywordGroups.length }}
    </span>
    <span class="material-symbols-outlined text-sm">
      {{ kgExpanded ? 'expand_less' : 'expand_more' }}
    </span>
  </button>

  <div v-if="kgExpanded" class="mt-2 w-full">
    <div class="bg-surface-container-low rounded-xl p-4">
      <div class="mb-3">
        <SearchInput
          v-model="kgSearch"
          placeholder="搜尋技術..."
          class="[&_input]:rounded-lg [&_input]:py-1.5"
        />
      </div>

      <div
        v-if="companyStore.selectedKeywordGroups.length > 1"
        class="mb-3"
      >
        <OperatorToggle
          :model-value="companyStore.keywordGroupOperator"
          @update:model-value="onOperatorChange"
        />
      </div>

      <div
        v-if="!kgSearch.trim() && kgTabs.length"
        class="mb-3 flex flex-wrap gap-1.5"
      >
        <button
          v-for="tab in kgTabs"
          :key="tab.value"
          class="cursor-pointer rounded-full border px-2.5 py-0.5 text-sm font-bold transition-colors"
          :class="
            selectedKgCategory === tab.value
              ? 'bg-primary border-primary text-on-primary'
              : 'border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
          "
          @click="selectedKgCategory = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        class="flex max-h-44 flex-wrap gap-1.5 overflow-auto"
      >
        <button
          v-for="kg in kgMappings"
          :key="kg.keyword_group"
          class="cursor-pointer rounded px-2.5 py-1 text-sm font-bold  transition-colors"
          :class="
            companyStore.selectedKeywordGroups.includes(
              kg.keyword_group,
            )
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
          "
          @click="
            companyStore.toggleKeywordGroup(
              kg.keyword_group,
            )
          "
        >
          {{ kg.keyword_group }}
        </button>
      </div>
    </div>
  </div>
</template>
