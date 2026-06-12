<script setup lang="ts">
import { ref } from 'vue';

import OperatorToggle from '../../../components/OperatorToggle.vue';
import TechIcon from '../../../components/TechIcon.vue';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { useKeywordStore } from '../../keyword/useKeywordStore';

const keywordStore = useKeywordStore();

function tagLabel(tag: string): string {
  return TAG_LABEL_MAP[tag] ?? tag;
}

const tabsExpanded = ref(false);
const TABS_COLLAPSED_LIMIT = 4;

const tabTooltip = ref<{
  text: string;
  x: number;
  y: number;
} | null>(null);

function showTabTooltip(e: MouseEvent, text: string): void {
  const rect = (
    e.currentTarget as HTMLElement
  ).getBoundingClientRect();
  tabTooltip.value = {
    text,
    x: rect.left + rect.width / 2,
    y: rect.top,
  };
}

function hideTabTooltip(): void {
  tabTooltip.value = null;
}
</script>

<template>
  <section>
    <div class="relative mb-3">
      <span
        class="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!"
        >search</span
      >
      <input
        v-model="keywordStore.keywordSearch"
        type="text"
        placeholder="搜尋技能..."
        class="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border py-2 pr-8 pl-9 text-sm font-bold focus:outline-none"
      />
      <button
        v-if="keywordStore.keywordSearch"
        class="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 flex -translate-y-1/2 cursor-pointer"
        @click="keywordStore.keywordSearch = ''"
      >
        <span class="material-symbols-outlined text-base"
          >close</span
        >
      </button>
    </div>

    <div class="mb-3 flex flex-wrap gap-1.5">
      <div
        v-for="item in tabsExpanded
          ? keywordStore.visibleTabs
          : keywordStore.visibleTabs.slice(
              0,
              TABS_COLLAPSED_LIMIT,
            )"
        :key="item.value"
        class="relative"
        @mouseenter="showTabTooltip($event, item.tooltip)"
        @mouseleave="hideTabTooltip"
      >
        <button
          class="cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold transition-colors"
          :class="
            keywordStore.selectedTab === item.value
              ? 'bg-primary border-primary text-on-primary'
              : keywordStore.categoriesWithSelections.has(
                    item.value,
                  )
                ? 'border-primary text-primary hover:bg-primary/5'
                : 'border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
          "
          @click="keywordStore.selectedTab = item.value"
        >
          {{ item.label }}
          <span
            v-if="
              keywordStore.categoriesWithSelections.has(
                item.value,
              )
            "
            class="inline-block size-1.5 rounded-full bg-red-400 align-top"
          />
        </button>
      </div>

      <button
        v-if="
          keywordStore.visibleTabs.length >
          TABS_COLLAPSED_LIMIT
        "
        class="bg-surface-container border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold transition-colors"
        @click="tabsExpanded = !tabsExpanded"
      >
        {{
          tabsExpanded
            ? '收起'
            : `+${keywordStore.visibleTabs.length - TABS_COLLAPSED_LIMIT}`
        }}
      </button>
    </div>

    <div
      v-if="keywordStore.selectedTags.length > 1"
      class="mb-4"
    >
      <OperatorToggle
        v-model="keywordStore.keywordOperator"
      />
    </div>

    <div
      class="flex max-h-115 flex-wrap gap-2 overflow-auto"
    >
      <span
        v-for="keywordGroup in keywordStore.filteredKeywordGroupView"
        :key="keywordGroup.keyword_group"
        class="flex w-full cursor-pointer items-center justify-between gap-2 rounded px-4 py-2 text-sm font-bold"
        :class="
          keywordStore.selectedTags.includes(
            keywordGroup.keyword_group,
          )
            ? 'bg-primary text-on-primary'
            : keywordStore.excludedTags.includes(
                  keywordGroup.keyword_group,
                )
              ? 'bg-error text-on-error'
              : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
        "
        @click="
          keywordStore.toggleLanguage(
            keywordGroup.keyword_group,
          )
        "
      >
        <span class="flex min-w-0 flex-col gap-1">
          <span class="flex min-w-0 items-center gap-2">
            <TechIcon
              :slugs="keywordGroup.icon_slugs"
              :label="keywordGroup.label"
              :size="16"
            />
            <span class="truncate">{{
              keywordGroup.label
            }}</span>
          </span>

          <span
            v-if="keywordGroup.tags?.length"
            class="flex flex-wrap gap-1"
          >
            <span
              v-for="tag in keywordGroup.tags"
              :key="tag"
              class="rounded-full bg-current/12 px-1.5 py-px text-[11px] font-medium normal-case"
              >{{ tagLabel(tag) }}</span
            >
          </span>

          <span
            v-if="keywordGroup.parents?.length"
            class="flex flex-wrap items-center gap-1 normal-case opacity-70"
          >
            <span
              class="material-symbols-outlined text-[13px]! opacity-80"
              >subdirectory_arrow_right</span
            >
            <span
              v-for="parent in keywordGroup.parents"
              :key="parent"
              class="rounded-full border border-current/30 px-1.5 py-px text-[11px] font-medium"
              >{{ parent }}</span
            >
          </span>
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <span
            v-if="
              keywordStore.selectedTags.includes(
                keywordGroup.keyword_group,
              )
            "
            class="material-symbols-outlined text-sm"
            >check</span
          >
          <span
            v-else-if="
              keywordStore.excludedTags.includes(
                keywordGroup.keyword_group,
              )
            "
            class="material-symbols-outlined text-sm"
            >close</span
          >
          <span>{{ keywordGroup.count }}</span>
        </span>
      </span>
    </div>
  </section>

  <Teleport to="body">
    <div
      v-if="tabTooltip"
      class="pointer-events-none fixed z-50 -translate-x-1/2 rounded bg-[#001f2a] px-2 py-1 text-sm font-medium whitespace-nowrap text-white shadow"
      :style="{
        left: `${tabTooltip.x}px`,
        top: `${tabTooltip.y - 8}px`,
        transform: 'translate(-50%, -100%)',
      }"
    >
      {{ tabTooltip.text }}
    </div>
  </Teleport>
</template>
