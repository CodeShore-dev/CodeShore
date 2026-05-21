<script setup lang="ts">
import { computed, ref } from 'vue';

import { useKeywordStore } from '../../keyword/useKeywordStore';

type Props = {
  htmlContent: string;
  keywords: string[];
  selectedKeywords: Set<string>;
};

export type KeywordTooltipData = {
  keyword: string;
  groups: {
    name: string;
    count: number;
    category: string | null;
  }[];
  x: number;
  y: number;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  'tooltip-show': [data: KeywordTooltipData];
  'tooltip-hide': [];
  'keyword-select': [keyword: string];
}>();

const keywordStore = useKeywordStore();
const descriptionRef = ref<HTMLDivElement | null>(null);
const activeTooltipKeyword = ref<string | null>(null);
let hideTooltipTimer: ReturnType<typeof setTimeout> | null =
  null;

const highlightedContent = computed(() => {
  if (!props.htmlContent || props.keywords.length === 0) {
    return props.htmlContent;
  }

  const escapeRegExp = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const regex = new RegExp(
    `(?<![\\w-])(${props.keywords.map(escapeRegExp).join('|')})(?![\\w-]|(\\.$)\\w)`,
    'gi',
  );
  return props.htmlContent.replace(regex, match => {
    const isSelected = props.selectedKeywords.has(
      match.toLowerCase(),
    );
    return `<span data-keyword="${match.toLowerCase()}" class="${
      isSelected
        ? 'bg-primary text-on-primary'
        : 'bg-surface-container text-on-surface-variant'
    } cursor-pointer rounded-full px-3 py-1 text-sm font-bold ">${match}</span>`;
  });
});

const buildTooltipData = (
  span: HTMLElement,
): KeywordTooltipData => {
  const keyword = span.dataset.keyword!;
  const groups = keywordStore.keywordGroups
    .filter(g =>
      g.keywords
        .map(k => k.toLowerCase())
        .includes(keyword.toLowerCase()),
    )
    .map(g => ({
      name: g.keyword_group,
      count: g.count,
      category: g.category,
    }));
  const rect = span.getBoundingClientRect();
  return {
    keyword,
    groups,
    x: rect.left + rect.width / 2,
    y: rect.top,
  };
};

const showTooltip = (span: HTMLElement) => {
  if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
  const data = buildTooltipData(span);
  span.addEventListener('mouseleave', scheduleHideTooltip);
  activeTooltipKeyword.value = data.keyword;
  emit('tooltip-show', data);
};

const scheduleHideTooltip = () => {
  hideTooltipTimer = setTimeout(() => {
    activeTooltipKeyword.value = null;
    emit('tooltip-hide');
  }, 120);
};

const handleMouseOver = (event: MouseEvent) => {
  const span = (event.target as HTMLElement).closest(
    '[data-keyword]',
  ) as HTMLElement | null;
  if (span) {
    showTooltip(span);
  }
};

const handleMouseLeave = () => {
  scheduleHideTooltip();
};

const handleClick = (event: MouseEvent) => {
  const span = (event.target as HTMLElement).closest(
    '[data-keyword]',
  ) as HTMLElement | null;
  if (!span) return;
  if (activeTooltipKeyword.value === span.dataset.keyword) {
    activeTooltipKeyword.value = null;
    emit('tooltip-hide');
  } else {
    showTooltip(span);
  }
};

const handleMouseUp = () => {
  const selection = window.getSelection();
  const keyword = selection?.toString().trim();
  if (!keyword || !descriptionRef.value) return;
  const range = selection?.getRangeAt(0);
  if (
    !range ||
    !descriptionRef.value.contains(
      range.commonAncestorContainer,
    )
  )
    return;
  emit('keyword-select', keyword);
};
</script>

<template>
  <div
    ref="descriptionRef"
    class="text-on-surface-variant text-sm leading-relaxed"
    :class="{
      'whitespace-pre-wrap':
        !highlightedContent.startsWith('<'),
    }"
    @mouseover="handleMouseOver"
    @mouseleave="handleMouseLeave"
    @click="handleClick"
    @mouseup="handleMouseUp"
  >
    <div v-html="highlightedContent"></div>
  </div>
</template>

