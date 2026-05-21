<script setup lang="ts">
import { computed } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

type CompanyView = SupabaseView.CompanyView;
type KeywordGroupView = SupabaseView.KeywordGroupView;

interface Props {
  company: CompanyView;
  keywordGroups: KeywordGroupView[];
  categoryLabelMap: Record<string, string>;
  selectedKeywordGroups?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  selectedKeywordGroups: () => [],
});

const emit = defineEmits<{
  (e: 'click', companyName: string): void;
}>();

const CATEGORY_PRIORITY: Record<string, number> = {
  Language: 0,
  Framework: 1,
  Database: 2,
  Library: 3,
  Service: 4,
  Tool: 5,
};

const kgCategoryMap = computed(() => {
  const map = new Map<string, string>();
  for (const m of props.keywordGroups) {
    map.set(m.keyword_group, m.category ?? '');
  }
  return map;
});

const kgCountMap = computed(() => {
  const map = new Map<string, number>();
  for (const m of props.keywordGroups) {
    map.set(m.keyword_group, m.count);
  }
  return map;
});

function groupedKeywordGroups(
  groups: string[],
): { label: string; items: string[]; remaining: number }[] {
  const buckets = new Map<string, string[]>();
  for (const kg of groups) {
    const raw = kgCategoryMap.value.get(kg) ?? '';
    const cat = raw in CATEGORY_PRIORITY ? raw : '';
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(kg);
  }
  return [...buckets.entries()]
    .sort(
      ([a], [b]) =>
        (CATEGORY_PRIORITY[a] ?? 6) - (CATEGORY_PRIORITY[b] ?? 6),
    )
    .map(([cat, items]) => {
      const sorted = [...items].sort(
        (a, b) =>
          (kgCountMap.value.get(b) ?? 0) -
          (kgCountMap.value.get(a) ?? 0),
      );
      return {
        label: props.categoryLabelMap[cat] ?? '其他',
        items: sorted.slice(0, 5),
        remaining: Math.max(0, sorted.length - 5),
      };
    });
}
</script>

<template>
  <div
    class="bg-surface-container-low hover:bg-surface-container group flex cursor-pointer flex-col gap-3 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
    @click="emit('click', company.company_name)"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <h2
          class="text-on-surface truncate text-lg font-black"
          :title="company.company_name"
        >
          {{ company.company_name }}
        </h2>
        <span
          v-if="company.company_type"
          class="text-on-surface-variant text-sm font-medium"
        >
          {{ company.company_type }}
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span
          class="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-sm font-black"
        >
          {{ company.job_count }} 職缺
        </span>
        <a
          v-if="company.company_link"
          :href="company.company_link"
          target="_blank"
          rel="noopener noreferrer"
          class="text-on-surface-variant hover:text-primary flex items-center transition-colors"
          @click.stop
        >
          <span class="material-symbols-outlined text-base">open_in_new</span>
        </a>
      </div>
    </div>

    <div
      v-if="company.keyword_groups.length > 0"
      class="mt-1 space-y-2"
    >
      <div
        v-for="group in groupedKeywordGroups(company.keyword_groups)"
        :key="group.label"
        class="flex items-start gap-2"
      >
        <span
          class="text-on-surface-variant/50 mt-0.5 w-12 shrink-0 text-sm font-bold tracking-wide  leading-none"
        >
          {{ group.label }}
        </span>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="kg in group.items"
            :key="kg"
            class="rounded px-2 py-0.5 text-sm font-bold  transition-colors"
            :class="
              selectedKeywordGroups.includes(kg)
                ? 'bg-primary/15 text-primary'
                : 'bg-surface-container-highest text-on-surface-variant'
            "
          >
            {{ kg }}
          </span>
          <span
            v-if="group.remaining > 0"
            class="text-on-surface-variant/60 px-1 py-0.5 text-sm font-bold"
          >
            +{{ group.remaining }}
          </span>
        </div>
      </div>
    </div>

    <div
      class="text-primary mt-auto flex items-center gap-1 text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100"
    >
      <span class="material-symbols-outlined text-sm">arrow_forward</span>
      查看職缺
    </div>
  </div>
</template>
