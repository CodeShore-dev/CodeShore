<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { useJobStore } from '../useJobStore';
import JobSwipeCard from './JobSwipeCard.vue';

type Props = {
  job: SupabaseView.MvJob | undefined;
  isFirst: boolean;
  isLast: boolean;
};

const props = defineProps<Props>();

type Emits = {
  (e: 'close'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'updatePreference', preference: 'like' | 'dislike'): void;
};

const emit = defineEmits<Emits>();

const store = useJobStore();
const drawerRef = ref<HTMLDivElement | null>(null);
const swipeCardRef = ref<InstanceType<typeof JobSwipeCard> | null>(null);

const swipeLikeOpacity = computed(() => swipeCardRef.value?.likeOpacity ?? 0);
const swipeDislikeOpacity = computed(() => swipeCardRef.value?.dislikeOpacity ?? 0);

watch(
  () => props.job?.id,
  () => {
    if (drawerRef.value) drawerRef.value.scrollTop = 0;
  },
);

const drawerTitle = computed(() =>
  store.listViewPreference === 'like'
    ? '● 喜歡的職缺'
    : store.listViewPreference === 'dislike'
      ? '● 不喜歡的職缺'
      : '● 職缺',
);
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="job" class="fixed inset-0 z-50 flex">
        <div class="fixed inset-0 bg-black/50" @click="emit('close')" />
        <div
          class="relative z-10 ml-auto flex h-full w-full max-w-3xl flex-col bg-[#f4faff] shadow-2xl"
        >
          <!-- Swipe direction gradient overlays — absolute to the panel (not scroll content),
               so they remain visible at any scroll position -->
          <div
            class="pointer-events-none absolute inset-0 z-40 flex items-center justify-end pr-6"
            :style="{
              opacity: swipeLikeOpacity,
              background: 'linear-gradient(to left, rgba(0,61,146,0.28) 0%, transparent 55%)',
            }"
          >
            <div class="-rotate-12 rounded-lg border-4 border-[#003d92] bg-white/90 px-4 py-1 text-2xl font-black tracking-widest text-[#003d92]">
              喜歡
            </div>
          </div>
          <div
            class="pointer-events-none absolute inset-0 z-40 flex items-center justify-start pl-6"
            :style="{
              opacity: swipeDislikeOpacity,
              background: 'linear-gradient(to right, rgba(186,26,26,0.28) 0%, transparent 55%)',
            }"
          >
            <div class="rotate-12 rounded-lg border-4 border-[#ba1a1a] bg-white/90 px-4 py-1 text-2xl font-black tracking-widest text-[#ba1a1a]">
              不喜歡
            </div>
          </div>

          <!-- Scrollable content — overflow-y-auto is here, not on the panel, so
               the absolute overlays above cover only the visible viewport height -->
          <div ref="drawerRef" class="flex h-full flex-col overflow-y-auto">

          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between border-b border-[#001f2a]/6 bg-white px-6 py-4"
          >
            <span class="text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
              {{ drawerTitle }}
            </span>
            <button
              class="cursor-pointer text-[#434653] transition-colors hover:text-[#001f2a]"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Job card -->
          <div class="flex flex-1 flex-col p-4">
            <Transition name="card-swap" mode="out-in">
              <JobSwipeCard
                ref="swipeCardRef"
                :key="job.id"
                :job="job"
                @swipe="emit('updatePreference', $event)"
              />
            </Transition>
          </div>

          <!-- Navigation + preference buttons -->
          <div
            class="flex shrink-0 items-center justify-center gap-8 border-t border-[#001f2a]/6 bg-white pt-6 pb-10"
            :class="{ 'pointer-events-none opacity-50': store.loading }"
          >
            <!-- Prev -->
            <button
              :disabled="isFirst"
              class="flex h-10 w-10 items-center justify-center rounded-full bg-[#c9e7f7] text-[#434653] transition-all duration-200"
              :class="
                isFirst
                  ? 'cursor-not-allowed opacity-30'
                  : 'cursor-pointer hover:bg-[#a0d2f0] active:scale-90'
              "
              @click="emit('prev')"
            >
              <span class="material-symbols-outlined">chevron_left</span>
            </button>

            <!-- Dislike -->
            <div class="flex flex-col items-center gap-1.5">
              <button
                :disabled="store.listViewPreference === 'dislike' || store.preferenceUpdating"
                class="group flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-all duration-300"
                :class="
                  store.listViewPreference === 'dislike' || store.preferenceUpdating
                    ? 'cursor-not-allowed bg-[#ba1a1a] text-white opacity-50'
                    : 'cursor-pointer bg-[#c9e7f7] text-[#434653] hover:bg-[#ba1a1a] hover:text-white active:scale-90'
                "
                @click="swipeCardRef?.flyOut('dislike')"
              >
                <span class="material-symbols-outlined text-3xl transition-transform group-hover:rotate-90">close</span>
              </button>
              <span class="text-xs font-medium text-[#434653]">不喜歡</span>
            </div>

            <!-- Like -->
            <div class="flex flex-col items-center gap-1.5">
              <button
                :disabled="store.listViewPreference === 'like' || store.preferenceUpdating"
                class="group relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-[#003d92] to-[#1654b9] text-white shadow-xl transition-all duration-300"
                :class="
                  store.listViewPreference === 'like' || store.preferenceUpdating
                    ? 'cursor-not-allowed opacity-50 ring-4 ring-[#003d92] ring-offset-2'
                    : 'cursor-pointer hover:shadow-2xl active:scale-90'
                "
                @click="swipeCardRef?.flyOut('like')"
              >
                <div class="absolute inset-0 animate-ping rounded-full bg-[#003d92] opacity-0 group-hover:opacity-20" />
                <span
                  class="material-symbols-outlined text-4xl"
                  style="font-variation-settings: 'FILL' 1"
                >favorite</span>
              </button>
              <span class="text-xs font-medium text-[#001f2a]">喜歡</span>
            </div>

            <!-- Next -->
            <button
              :disabled="isLast"
              class="flex h-10 w-10 items-center justify-center rounded-full bg-[#c9e7f7] text-[#434653] transition-all duration-200"
              :class="
                isLast
                  ? 'cursor-not-allowed opacity-30'
                  : 'cursor-pointer hover:bg-[#a0d2f0] active:scale-90'
              "
              @click="emit('next')"
            >
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
  .bg-black\/50 {
    transition: opacity 0.25s ease;
  }
  > div:last-child {
    transition: transform 0.25s ease;
  }
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  > div:last-child {
    transform: translateX(100%);
  }
}

.card-swap-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.card-swap-enter-from {
  opacity: 0;
  transform: scale(0.94) translateY(16px);
}
.card-swap-leave-active {
  transition: opacity 0.15s ease;
}
.card-swap-leave-to {
  opacity: 0;
}
</style>
