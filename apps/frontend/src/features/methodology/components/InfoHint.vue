<script setup lang="ts">
import {
  onClickOutside,
  useEventListener,
} from '@vueuse/core';
import { computed, nextTick, ref } from 'vue';

import { useMetricExplanation } from '../composables/useMetricExplanation';
import type { MetricKey } from '../content/types';

interface InfoHintProps {
  /** 要解釋的分析區塊 key；查無對應內容時整個元件不渲染（8.3） */
  metric: MetricKey;
  /** 無障礙標籤覆寫；預設「查看此區資料如何計算」 */
  ariaLabel?: string;
}

const props = withDefaults(defineProps<InfoHintProps>(), {
  ariaLabel: '查看此區資料如何計算',
});

const { explanation, deepLink } = useMetricExplanation(
  props.metric,
);

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const popoverRef = ref<HTMLDivElement | null>(null);

// 觸發點座標（就地定位於問號附近，並夾制於視窗邊界避免水平溢出 6.6）
const anchorX = ref(0);
const anchorY = ref(0);

const popoverStyle = computed(() => {
  const margin = 8;
  const maxWidth = 320;
  const viewportWidth =
    typeof window === 'undefined'
      ? maxWidth
      : window.innerWidth;
  const half = maxWidth / 2;
  const clampedX = Math.min(
    Math.max(anchorX.value, margin + half),
    Math.max(viewportWidth - margin - half, margin + half),
  );
  return {
    left: `${clampedX}px`,
    top: `${anchorY.value + margin}px`,
    maxWidth: `${maxWidth}px`,
    transform: 'translateX(-50%)',
  };
});

const fields = computed(() => {
  if (explanation === null) return [];
  return [
    { label: '資料來源', value: explanation.source },
    { label: '統計口徑', value: explanation.scope },
    { label: '計算公式', value: explanation.formula },
    { label: '聚合方式', value: explanation.aggregation },
    {
      label: '更新頻率',
      value: explanation.updateFrequency,
    },
  ];
});

function updateAnchor() {
  const el = triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  anchorX.value = rect.left + rect.width / 2;
  anchorY.value = rect.bottom;
}

function openPopover() {
  updateAnchor();
  open.value = true;
}

function closePopover(restoreFocus = true) {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) {
    nextTick(() => triggerRef.value?.focus());
  }
}

function toggle() {
  if (open.value) {
    closePopover();
  } else {
    openPopover();
  }
}

// 外部點擊關閉並交還焦點（7.5）
onClickOutside(popoverRef, () => closePopover(), {
  ignore: [triggerRef],
});

// Esc 關閉並交還焦點（7.5）
useEventListener(
  document,
  'keydown',
  (event: KeyboardEvent) => {
    if (open.value && event.key === 'Escape') {
      event.stopPropagation();
      closePopover();
    }
  },
);
</script>

<template>
  <span v-if="explanation" class="inline-flex">
    <button
      ref="triggerRef"
      type="button"
      class="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-[#c3c6d5] bg-[#f4faff] text-xs font-bold text-[#003d92] transition-colors hover:bg-[#d9f2ff] focus:ring-2 focus:ring-[#003d92] focus:outline-none"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      @click="toggle"
    >
      ?
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="popoverRef"
        role="dialog"
        :aria-label="ariaLabel"
        class="fixed z-50 w-[calc(100vw-1rem)] rounded-xl border border-[#c3c6d5] bg-white p-4 text-left shadow-2xl sm:w-auto"
        :style="popoverStyle"
      >
        <p
          class="mb-2 text-sm font-bold tracking-widest text-[#001f2a]"
        >
          {{ explanation.title }}
        </p>
        <dl class="space-y-1.5">
          <div v-for="field in fields" :key="field.label">
            <dt
              class="text-xs font-bold tracking-widest text-[#434653]"
            >
              {{ field.label }}
            </dt>
            <dd
              class="text-sm leading-relaxed text-[#001f2a]"
            >
              {{ field.value }}
            </dd>
          </div>
        </dl>
        <RouterLink
          v-if="deepLink"
          :to="deepLink"
          class="mt-3 inline-block text-sm font-bold text-[#003d92] underline transition-colors hover:text-[#001f2a]"
        >
          查看完整推導
        </RouterLink>
      </div>
    </Teleport>
  </span>
</template>
