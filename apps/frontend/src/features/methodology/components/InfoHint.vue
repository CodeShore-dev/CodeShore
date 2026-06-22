<script setup lang="ts">
import {
  onClickOutside,
  useEventListener,
} from '@vueuse/core';
import { computed, nextTick, ref } from 'vue';

import { useMetricExplanation } from '../composables/useMetricExplanation';
import type { MetricKey } from '../content/types';

interface InfoHintProps {
  metric: MetricKey;
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

const shiftX = ref(0);

const popoverStyle = computed(() => ({
  transform: `translateX(calc(-50% + ${shiftX.value}px))`,
}));

function updateAnchor() {
  const el = triggerRef.value;
  if (!el) return;
  const margin = 8;
  const desktopWidth = 400;
  const viewportWidth =
    typeof window === 'undefined'
      ? desktopWidth
      : window.innerWidth;
  // 小裝置為全寬（扣掉左右間距），桌機固定寬度，需與下方 class 一致
  const width =
    viewportWidth >= 640
      ? desktopWidth
      : viewportWidth - margin * 2;
  const half = width / 2;
  const centerX = el.getBoundingClientRect().left + el.offsetWidth / 2;
  const idealLeft = centerX - half;
  const idealRight = centerX + half;
  if (idealLeft < margin) {
    shiftX.value = margin - idealLeft;
  } else if (idealRight > viewportWidth - margin) {
    shiftX.value = viewportWidth - margin - idealRight;
  } else {
    shiftX.value = 0;
  }
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

onClickOutside(popoverRef, () => closePopover(), {
  ignore: [triggerRef],
});

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
    <span class="relative inline-flex">
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
      <div
        v-if="open"
        ref="popoverRef"
        role="dialog"
        :aria-label="ariaLabel"
        class="absolute top-full left-1/2 z-49 mt-2 w-[calc(100vw-1rem)] rounded-xl border border-[#c3c6d5] bg-white p-4 text-left shadow-2xl sm:w-[400px] sm:max-w-[400px]"
        :style="popoverStyle"
      >
        <div
          class="mb-3 flex items-start justify-between gap-3 border-b border-[#e8eaf0] pb-2.5"
        >
          <p
            class="text-base font-black tracking-tight text-[#001f2a]"
          >
            {{ explanation.title }}
          </p>
          <button
            type="button"
            class="-m-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9398a6] transition-colors hover:bg-[#f4faff] hover:text-[#001f2a] focus:ring-2 focus:ring-[#003d92] focus:outline-none"
            aria-label="關閉"
            @click="closePopover()"
          >
            <span
              class="material-symbols-outlined"
              style="font-size: 18px"
            >
              close
            </span>
          </button>
        </div>
        <p
          v-if="explanation.intro"
          class="mb-3 text-sm leading-relaxed text-[#5b6070]"
        >
          {{ explanation.intro }}
        </p>
        <ul class="space-y-3">
          <li
            v-for="item in explanation.items"
            :key="item.name"
          >
            <p
              class="text-sm font-bold text-[#001f2a]"
            >
              {{ item.name }}
            </p>
            <p
              class="mt-0.5 text-sm leading-relaxed font-normal text-[#5b6070]"
            >
              {{ item.detail }}
            </p>
          </li>
        </ul>
        <div
          v-if="explanation.note || deepLink"
          class="mt-4 space-y-2 border-t border-[#e8eaf0] pt-3"
        >
          <p
            v-if="explanation.note"
            class="text-xs leading-relaxed text-[#9398a6]"
          >
            {{ explanation.note }}
          </p>
          <RouterLink
            v-if="deepLink"
            :to="deepLink"
            class="inline-flex items-center text-sm font-bold text-[#003d92] underline transition-colors hover:text-[#001f2a]"
          >
            查看完整推導
          </RouterLink>
        </div>
      </div>
    </span>
  </span>
</template>
