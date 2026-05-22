<script setup lang="ts">
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import { computed, ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { formatDateInfo } from '../../../utils/format';
import { useAuthStore } from '../../auth/useAuthStore';
import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useJobStore } from '../useJobStore';
import JobCardSkeleton from './JobCardSkeleton.vue';
import JobCrawlPanel from './JobCrawlPanel.vue';
import JobDescriptionHighlighter, {
  type KeywordTooltipData,
} from './JobDescriptionHighlighter.vue';
import JobHandoffCTA from './JobHandoffCTA.vue';
import JobKeywordChips from './JobKeywordChips.vue';
import JobKeywordPopover from './JobKeywordPopover.vue';

type Props = { job?: Partial<SupabaseView.JobView> };
const props = withDefaults(defineProps<Props>(), { job: () => ({}) });

const store = useJobStore();
const authStore = useAuthStore();
const keywordStore = useKeywordStore();

const keywordGroupMapping = computed(
  () =>
    props.job.keyword_group_mappings
      ?.filter(Boolean)
      .map(x => x.split(':'))
      .map(([key, value]) => {
        const group = keywordStore.keywordGroups.find(g => g.keyword_group === key);
        return { key, label: group?.label, value: value.split(',') };
      }) ?? [],
);

const allKeywords = computed(() =>
  keywordGroupMapping.value
    .filter(x => keywordStore.keywordGroups.some(y => y.keyword_group === x.key))
    .flatMap(m => m.value)
    .sort((a, b) => b.length - a.length),
);

const selectedKeywordsSet = computed(() =>
  new Set(
    keywordStore.selectedTags
      .flatMap(x => keywordGroupMapping.value.find(y => y.key === x)?.value ?? [])
      .map(k => k.toLowerCase()),
  ),
);

const updatedAt = computed(() => dayjs(props.job.updated_at));
const updatedAtInfo = computed(() =>
  formatDateInfo(
    updatedAt.value,
    props.job.updated_at ? updatedAt.value.format('MM/DD HH:mm') : '--/-- --:--',
  ),
);

const keywordTooltip = ref<KeywordTooltipData | null>(null);
const popover = ref<{ keyword: string; x: number; y: number } | null>(null);

function handleKeywordSelect(keyword: string): void {
  if (!authStore.canEdit) return;
  const range = window.getSelection()?.getRangeAt(0);
  if (!range) return;
  const rect = range.getBoundingClientRect();
  popover.value = { keyword, x: rect.left + rect.width / 2, y: rect.top };
}

const description = computed(() => {
  if (!props.job.description) return '';
  const $ = cheerio.load(props.job.description);
  $('*').each((_, el) => { (el as unknown as any).attribs = {}; });
  return $('body').html()?.trim() ?? '';
});
</script>

<template>
  <div class="group relative w-full">
    <div class="flex min-h-110 flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <JobCardSkeleton v-if="store.loading" />

      <div v-else class="flex grow flex-col p-4 lg:p-8">
        <!-- Company + closed badge -->
        <div class="mb-6">
          <div class="mb-2 flex items-center gap-2">
            <span
              v-if="job.closed"
              class="rounded bg-[#ffdad6] px-2 py-0.5 text-[11px] font-bold text-[#93000a]"
            >已關閉</span>
            <span class="text-sm font-bold text-[#434653]">{{ job.company_name }}</span>
          </div>
          <h3
            class="mb-4 text-[36px] font-black leading-tight tracking-[-0.02em] break-words"
            :class="job.closed ? 'text-[#001f2a]/40' : 'text-[#001f2a]'"
          >{{ job.title }}</h3>
          <div class="flex flex-wrap items-center gap-4 text-sm text-[#434653]">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="material-symbols-outlined text-lg">location_on</span>{{ job.location }}
            </span>
            <span class="flex items-center gap-1.5 font-bold text-[#9a4600]">
              <span class="material-symbols-outlined text-lg">payments</span>{{ job.salary }}
            </span>
            <div class="ml-auto flex items-center gap-3">
              <JobCrawlPanel v-if="job.id" :job-id="job.id as string" />
              <span
                class="flex items-center gap-1.5 font-medium"
                :title="updatedAt.format('YYYY/MM/DD HH:mm:ss')"
              >
                <span class="material-symbols-outlined text-lg">update</span>{{ updatedAtInfo }}
              </span>
            </div>
          </div>
        </div>

        <JobKeywordChips :mapping="keywordGroupMapping" :selected-keywords-set="selectedKeywordsSet" />
        <JobHandoffCTA :detail-link="job.detail_link" />

        <div class="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#434653]">職缺描述 · 來自原始 JD</div>
        <JobDescriptionHighlighter
          :html-content="description"
          :keywords="allKeywords"
          :selected-keywords="selectedKeywordsSet"
          @tooltip-show="keywordTooltip = $event"
          @tooltip-hide="keywordTooltip = null"
          @keyword-select="handleKeywordSelect"
        />
      </div>
    </div>
  </div>

  <!-- Keyword tooltip overlay -->
  <Teleport to="body">
    <div
      v-if="keywordTooltip"
      class="pointer-events-auto fixed z-50"
      :style="{
        left: `${keywordTooltip.x}px`,
        top: `${keywordTooltip.y - 8}px`,
        transform: 'translate(-50%, -100%)',
      }"
      @mouseleave="keywordTooltip = null"
    >
      <div class="min-w-44 rounded-xl border-2 border-[#c3c6d5] bg-white p-3 shadow-xl">
        <p class="mb-2 text-sm font-black tracking-widest text-[#003d92]">
          {{ keywordTooltip.keyword }}
        </p>
        <div v-if="keywordTooltip.groups.length" class="space-y-1.5">
          <div
            v-for="group in keywordTooltip.groups"
            :key="group.name"
            class="flex items-center justify-between gap-3"
          >
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-sm font-bold text-[#001f2a]">{{ group.name }}</span>
              <div class="mt-2 flex flex-wrap gap-1">
                <span
                  v-if="group.category"
                  class="rounded bg-[#f4faff] px-1.5 py-0.5 text-[9px] font-bold text-[#434653]"
                >{{ group.category }}</span>
              </div>
            </div>
            <span class="shrink-0 text-sm font-bold text-[#434653]">{{ group.count }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-[#434653]">尚無群組資料</p>
      </div>
    </div>
  </Teleport>

  <JobKeywordPopover
    v-if="popover"
    :keyword="popover.keyword"
    :x="popover.x"
    :y="popover.y"
    @close="popover = null"
  />
</template>
