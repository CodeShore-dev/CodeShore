<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Pagination from '../../../components/Pagination.vue';
import TechIcon from '../../../components/TechIcon.vue';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWan } from '../../../utils/format';
import { useTechCombos } from '../composables/useTechCombos';

const route = useRoute();
const router = useRouter();

const PAGE_SIZE = 24;

const {
  loadingLanguages,
  languages,
  loadLanguages,
  loading,
  items,
  totalCount,
  fetchPage,
} = useTechCombos();

const selectedTech = ref('');
const page = ref(1);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)),
);

const selectedLabel = computed(
  () =>
    languages.value.find(
      l => l.keyword_group === selectedTech.value,
    )?.label ?? selectedTech.value,
);

function load() {
  if (!selectedTech.value) return;
  fetchPage({
    tech: selectedTech.value,
    page: page.value,
    pageSize: PAGE_SIZE,
  });
}

function setTech(value: string) {
  if (selectedTech.value === value) return;
  selectedTech.value = value;
  page.value = 1;
  router.replace({
    query: { ...route.query, tech: value },
  });
  load();
}

function goToPage(value: number) {
  page.value = value;
  load();
}

function goJobs(tech1: string, tech2: string) {
  router.push({
    name: 'jobs',
    query: { tags: `${tech1},${tech2}` },
  });
}

(async () => {
  await loadLanguages();
  const queryTech = route.query.tech;
  const initial =
    typeof queryTech === 'string' &&
    languages.value.some(l => l.keyword_group === queryTech)
      ? queryTech
      : languages.value[0]?.keyword_group;
  if (initial) {
    selectedTech.value = initial;
    load();
  }
})();
</script>

<template>
  <div class="w-full">
    <!-- Page heading -->
    <div class="mb-8">
      <div
        class="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]"
      >
        ● 技術組合 · TECH COMBOS
      </div>
      <div class="flex items-end justify-between gap-4">
        <h1
          class="text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]"
        >
          最常一起出現的<br class="sm:hidden" />技術組合
        </h1>
        <span
          v-if="selectedTech && !loading"
          class="shrink-0 pb-1 text-sm font-semibold text-[#434653]"
        >
          共 {{ totalCount.toLocaleString() }} 組
        </span>
      </div>
    </div>

    <!-- Language chips -->
    <div
      v-if="loadingLanguages"
      class="mb-6 flex flex-wrap gap-2"
    >
      <div
        v-for="i in 10"
        :key="i"
        class="h-9 w-24 animate-pulse rounded-full bg-[#d9f2ff]"
      />
    </div>
    <div v-else class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="lang in languages"
        :key="lang.keyword_group"
        class="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors"
        :class="
          selectedTech === lang.keyword_group
            ? 'border-[#003d92] bg-[#003d92] text-white'
            : 'border-[#c9e7f7] bg-white text-[#434653] hover:bg-[#d9f2ff]'
        "
        @click="setTech(lang.keyword_group)"
      >
        {{ lang.label }}
      </button>
    </div>

    <div
      v-if="selectedTech"
      class="mb-4 text-base font-black text-[#001f2a]"
    >
      與
      <span class="text-[#003d92]">{{
        selectedLabel
      }}</span>
      最常同時出現的技術
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="i in 9"
        :key="i"
        class="h-36 animate-pulse rounded-xl bg-[#d9f2ff]"
      />
    </div>

    <!-- Empty -->
    <div
      v-else-if="items.length === 0"
      class="py-24 text-center"
    >
      <div
        class="mb-3 text-5xl font-black text-[#001f2a]/10"
      >
        0
      </div>
      <p class="text-sm font-bold text-[#434653]">
        找不到這個語言的技術組合
      </p>
    </div>

    <!-- Grid -->
    <template v-else>
      <div
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <button
          v-for="(combo, i) in items"
          :key="`${combo.tech1}+${combo.tech2}`"
          class="group flex min-w-0 cursor-pointer flex-col justify-between rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          @click="goJobs(combo.tech1, combo.tech2)"
        >
          <div
            class="flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-[#434653]"
          >
            <span
              >#{{ (page - 1) * PAGE_SIZE + i + 1 }}</span
            >
            <span
              class="flex items-center gap-0.5 font-sans font-bold tracking-normal text-[#003d92]"
            >
              前往職缺
              <span
                class="material-symbols-outlined transition-transform group-hover:translate-x-0.5"
                style="font-size: 13px"
                >arrow_forward</span
              >
            </span>
          </div>
          <div
            class="mt-2 flex flex-col gap-1 leading-tight font-black tracking-[-0.02em] text-[#001f2a]"
            style="font-size: 1.375rem"
          >
            <div class="flex min-w-0 items-center gap-1.5">
              <TechIcon
                :slugs="combo.tech1_icons"
                :label="combo.tech1_label"
              />
              <span class="min-w-0 wrap-break-word">{{
                combo.tech1_label
              }}</span>
            </div>
            <span class="px-2 text-[#fd7700]">+</span>
            <div class="flex min-w-0 items-center gap-1.5">
              <TechIcon
                :slugs="combo.tech2_icons"
                :label="combo.tech2_label"
              />
              <span class="min-w-0 wrap-break-word">{{
                combo.tech2_label
              }}</span>
            </div>
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1">
            <span
              v-for="tag in combo.tech2_tags ?? []"
              :key="tag"
              class="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#434653]"
            >
              {{ TAG_LABEL_MAP[tag] ?? tag }}
            </span>
          </div>
          <div class="mt-2 flex items-end justify-between">
            <div>
              <div
                class="leading-none font-black text-[#003d92] tabular-nums"
                style="font-size: 1.375rem"
              >
                {{ combo.job_count.toLocaleString() }}
              </div>
              <div class="text-[10px] text-[#434653]">
                個職缺
              </div>
            </div>
            <div class="text-[11px]">
              <div class="text-right">
                <div
                  class="font-bold text-[#434653] tabular-nums"
                >
                  {{ toWan(combo.median_min_year) }}–{{
                    toWan(combo.median_max_year)
                  }}
                </div>
                <div class="text-[11px]">年薪</div>
              </div>
              <div class="text-right">
                <div
                  class="font-bold text-[#434653] tabular-nums"
                >
                  {{ toWan(combo.median_min_month) }}–{{
                    toWan(combo.median_max_month)
                  }}
                </div>
                <div class="text-[11px]">月薪</div>
              </div>
            </div>
          </div>
        </button>
      </div>
      <Pagination
        :current-page="page"
        :total-pages="totalPages"
        @update:current-page="goToPage($event)"
      />
    </template>
  </div>
</template>
