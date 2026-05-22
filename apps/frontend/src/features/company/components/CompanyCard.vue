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

const kgLabelMap = computed(() => {
  const map = new Map<string, string>();
  for (const m of props.keywordGroups) {
    map.set(m.keyword_group, m.label);
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

const selectedKeywordGroupsSet = computed(
  () => new Set(props.selectedKeywordGroups),
);

const groupedKeywordGroups = computed(() => {
  const buckets = new Map<string, string[]>();
  for (const kg of props.company.keyword_groups) {
    const raw = kgCategoryMap.value.get(kg) ?? '';
    const cat = raw in CATEGORY_PRIORITY ? raw : '';
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(kg);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (CATEGORY_PRIORITY[a] ?? 6) - (CATEGORY_PRIORITY[b] ?? 6))
    .map(([cat, items]) => {
      const sorted = [...items].sort(
        (a, b) => (kgCountMap.value.get(b) ?? 0) - (kgCountMap.value.get(a) ?? 0),
      );
      return {
        label: props.categoryLabelMap[cat] ?? '其他',
        items: sorted.slice(0, 5),
        remaining: Math.max(0, sorted.length - 5),
      };
    });
});
</script>

<template>
  <div
    class="group flex cursor-pointer flex-col gap-3.5 rounded-[20px] bg-white p-6 shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,31,42,0.08)] active:scale-[0.98]"
    @click="emit('click', company.company_name)"
  >
    <!-- Header: name + job count -->
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-[22px] font-black leading-tight tracking-[-0.02em] text-[#001f2a]" :title="company.company_name">
          {{ company.company_name }}
        </h2>
        <span v-if="company.company_type" class="mt-1 block text-[11px] font-bold tracking-[0.05em] text-[#434653]">
          {{ company.company_type }}
        </span>
      </div>
      <div class="shrink-0 text-right">
        <div class="tabular-nums font-black leading-none tracking-[-0.02em] text-[#003d92]" style="font-size: 1.75rem">
          {{ company.job_count }}
        </div>
        <div class="mt-0.5 text-[11px] text-[#434653]">個職缺</div>
      </div>
    </div>

    <!-- Keyword groups by category -->
    <div v-if="company.keyword_groups.length > 0" class="space-y-2">
      <div v-for="group in groupedKeywordGroups" :key="group.label">
        <div class="mb-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">{{ group.label }}</div>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="kg in group.items"
            :key="kg"
            class="rounded px-2 py-0.5 text-xs font-bold transition-colors"
            :class="
              selectedKeywordGroupsSet.has(kg)
                ? 'bg-[#003d92]/15 text-[#003d92]'
                : 'bg-[#c9e7f7] text-[#434653]'
            "
          >{{ kgLabelMap.get(kg) ?? kg }}</span>
          <span v-if="group.remaining > 0" class="px-1 py-0.5 text-xs font-bold text-[#434653]/60">+{{ group.remaining }}</span>
        </div>
      </div>
    </div>

    <!-- Footer CTA -->
    <div class="mt-auto flex items-center justify-between pt-2">
      <span class="flex items-center gap-1 text-xs font-bold text-[#003d92] opacity-0 transition-opacity group-hover:opacity-100">
        查看職缺 →
      </span>
      <a
        v-if="company.company_link"
        :href="company.company_link"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-0.5 text-[11px] text-[#434653] hover:text-[#003d92]"
        @click.stop
      >
        104.com.tw
        <span class="material-symbols-outlined" style="font-size:12px">open_in_new</span>
      </a>
    </div>
  </div>
</template>
