<script setup lang="ts">
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import { computed, ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { formatDateInfo } from '../../../utils/format';
import { useAuthStore } from '../../auth/useAuthStore';
import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useJobStore } from '../useJobStore';
import JobCrawlPanel from './JobCrawlPanel.vue';
import JobDescriptionHighlighter, {
  type KeywordTooltipData,
} from './JobDescriptionHighlighter.vue';
import JobKeywordPopover from './JobKeywordPopover.vue';

type Props = { job?: Partial<SupabaseView.JobView> };
const props = withDefaults(defineProps<Props>(), {
  job: () => ({}),
});

const store = useJobStore();
const authStore = useAuthStore();
const keywordStore = useKeywordStore();

const keywordGroupMapping = computed(
  () =>
    props.job.keyword_group_mappings
      ?.filter(Boolean)
      .map(x => x.split(':'))
      .map(([key, value]) => ({
        key,
        value: value.split(','),
      })) ?? [],
);

const allKeywords = computed(() =>
  keywordGroupMapping.value
    .filter(x =>
      keywordStore.keywordGroups.some(
        y => y.keyword_group === x.key,
      ),
    )
    .flatMap(m => m.value)
    .sort((a, b) => b.length - a.length),
);

const selectedKeywordsSet = computed(() => {
  const keywords = keywordStore.selectedTags
    .map(
      x =>
        keywordGroupMapping.value.find(y => y.key === x)!,
    )
    .filter(Boolean)
    .flatMap(m => m.value);
  return new Set(keywords.map(k => k.toLowerCase()));
});

const updatedAt = computed(() =>
  dayjs(props.job.updated_at),
);
const updatedAtInfo = computed(() =>
  formatDateInfo(
    updatedAt.value,
    props.job.updated_at
      ? updatedAt.value.format('MM/DD HH:mm')
      : '--/-- --:--',
  ),
);

const keywordTooltip = ref<KeywordTooltipData | null>(null);
const popover = ref<{
  keyword: string;
  x: number;
  y: number;
} | null>(null);

function handleKeywordSelect(keyword: string): void {
  if (authStore.canEdit) {
    const range = window.getSelection()?.getRangeAt(0);
    if (!range) return;
    const rect = range.getBoundingClientRect();
    popover.value = {
      keyword,
      x: rect.left + rect.width / 2,
      y: rect.top,
    };
  }
}

const description = computed(() => {
  if (!props.job.description) return '';
  const $ = cheerio.load(props.job.description);

  $('*').each((_, el) => {
    (el as unknown as any).attribs = {};
  });

  return $('body').html()?.trim() ?? '';
});
</script>

<template>
  <div class="group relative w-full">
    <div
      class="bg-surface-container-lowest flex min-h-110 flex-col overflow-hidden rounded-xl shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
    >
      <div
        v-if="store.loading"
        class="flex grow animate-pulse flex-col p-8"
      >
        <div class="mb-6">
          <div
            class="bg-surface-container-high mb-5 h-8 w-3/4 rounded"
          ></div>
          <div class="flex flex-wrap gap-3">
            <div
              class="bg-surface-container-high h-5 w-24 rounded"
            ></div>
            <div
              class="bg-surface-container-high h-5 w-32 rounded"
            ></div>
            <div class="ml-auto flex gap-3">
              <div
                class="bg-surface-container-high h-5 w-28 rounded"
              ></div>
            </div>
          </div>
        </div>
        <div class="space-y-3 py-1">
          <div
            v-for="(w, i) in [
              'w-full',
              'w-5/6',
              'w-full',
              'w-4/6',
            ]"
            :key="i"
            class="bg-surface-container-high h-4 rounded"
            :class="w"
          ></div>
        </div>
        <div class="mt-8 flex flex-wrap gap-2">
          <div
            v-for="(w, i) in [
              'w-16',
              'w-20',
              'w-24',
              'w-14',
            ]"
            :key="i"
            class="bg-surface-container-high h-6 rounded-full"
            :class="w"
          ></div>
        </div>
      </div>

      <div v-else class="flex grow flex-col p-4 lg:p-8">
        <div class="mb-6">
          <div
            class="flex items-center justify-between gap-2"
          >
            <div class="mb-4 flex items-start gap-3">
              <h3
                class="text-3xl leading-none font-extrabold break-all"
                :class="
                  job.closed
                    ? 'text-on-surface/40'
                    : 'text-on-surface'
                "
              >
                {{ job.title }}
              </h3>
              <span
                v-if="job.closed"
                class="bg-error/15 text-error mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-sm font-black tracking-widest "
                >已關閉</span
              >
            </div>
            <a :href="job.detail_link" target="_blank">
              <button
                class="text-primary hover:bg-primary-container flex h-fit w-fit cursor-pointer items-center justify-center rounded-md text-sm transition-all hover:text-white active:scale-90"
              >
                <span
                  class="material-symbols-outlined text-sm"
                  data-icon="open_in_new"
                  >open_in_new</span
                >
              </button>
            </a>
          </div>
          <h3
            class="text-on-surface-variant mb-4 text-xl font-bold tracking-tight"
          >
            {{ job.company_name }}
          </h3>
          <div class="flex flex-wrap items-center gap-3">
            <div
              class="text-on-surface-variant flex items-center gap-1.5 font-medium"
            >
              <span
                class="material-symbols-outlined text-lg"
                data-icon="location_on"
                >location_on</span
              >{{ job.location }}
            </div>
            <div
              class="text-on-surface-variant flex items-center gap-1.5 font-medium"
            >
              <span
                class="material-symbols-outlined text-lg"
                data-icon="payments"
                >payments</span
              >{{ job.salary }}
            </div>
            <div class="ml-auto flex items-center gap-3">
              <JobCrawlPanel
                v-if="job.id"
                :job-id="job.id as string"
              />
              <div
                class="text-on-surface-variant flex items-center gap-1.5 text-sm font-medium"
                :title="
                  updatedAt.format('YYYY/MM/DD HH:mm:ss')
                "
              >
                <span
                  class="material-symbols-outlined text-lg"
                  data-icon="update"
                  >update</span
                >{{ updatedAtInfo }}
              </div>
            </div>
          </div>
        </div>
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
      <div
        class="bg-surface-container-lowest border-surface-container min-w-44 rounded-xl border-2 p-3 shadow-xl"
      >
        <p
          class="text-primary mb-2 text-sm font-black tracking-widest "
        >
          {{ keywordTooltip.keyword }}
        </p>
        <div
          v-if="keywordTooltip.groups.length"
          class="space-y-1.5"
        >
          <div
            v-for="group in keywordTooltip.groups"
            :key="group.name"
            class="flex items-center justify-between gap-3"
          >
            <div class="flex min-w-0 flex-col">
              <span
                class="text-on-surface truncate text-sm font-bold"
                >{{ group.name }}</span
              >
              <div class="mt-2 flex flex-wrap gap-1">
                <span
                  v-if="group.category"
                  class="bg-surface-container text-on-surface-variant rounded px-1.5 py-0.5 text-[9px] font-bold "
                  >{{ group.category }}</span
                >
              </div>
            </div>
            <span
              class="text-on-surface-variant shrink-0 text-sm font-bold"
              >{{ group.count }}</span
            >
          </div>
        </div>
        <p v-else class="text-on-surface-variant text-sm">
          尚無群組資料
        </p>
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

