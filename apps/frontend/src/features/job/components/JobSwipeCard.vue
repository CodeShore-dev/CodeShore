<script setup lang="ts">
import { ref, watch } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { useSwipeCard } from '../composables/useSwipeCard';
import { useJobStore } from '../useJobStore';
import JobCard from './JobCard.vue';
import JobSwipeHint from './JobSwipeHint.vue';

type Props = { job: SupabaseView.MvJob | undefined };
defineProps<Props>();

const emit = defineEmits<{
  swipe: [preference: 'like' | 'dislike'];
}>();

const store = useJobStore();

const HINT_KEY = 'codeshore:job-swipe-hint-dismissed';
const hintDismissed = ref(
  localStorage.getItem(HINT_KEY) === '1',
);
const dismissHint = () => {
  hintDismissed.value = true;
  localStorage.setItem(HINT_KEY, '1');
};

const {
  cardRef,
  cardStyle,
  commit,
  dragging,
  flying,
  likeOpacity,
  dislikeOpacity,
} = useSwipeCard({
  canLike: () => store.listViewPreference !== 'like',
  canDislike: () => store.listViewPreference !== 'dislike',
  onCommit: preference => emit('swipe', preference),
});

watch(dragging, isDragging => {
  if (isDragging) dismissHint();
});

defineExpose({ flyOut: commit, likeOpacity, dislikeOpacity });
</script>

<template>
  <div class="relative w-full">
    <Transition name="hint-fade">
      <JobSwipeHint
        v-if="!hintDismissed"
        @dismiss="dismissHint"
      />
    </Transition>

    <div class="relative">
      <Transition name="stamp-pop">
        <div
          v-if="flying"
          :key="flying"
          class="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2"
        >
          <span
            class="material-symbols-outlined text-[120px] drop-shadow-lg"
            :class="flying === 'like' ? 'text-[#003d92]' : 'text-[#ba1a1a]'"
            style="font-variation-settings: 'FILL' 1"
          >{{ flying === 'like' ? 'favorite' : 'close' }}</span>
          <span
            class="rounded-lg border-4 px-5 py-1 text-2xl font-black tracking-widest drop-shadow"
            :class="
              flying === 'like'
                ? 'border-[#003d92] bg-white/90 text-[#003d92]'
                : 'border-[#ba1a1a] bg-white/90 text-[#ba1a1a]'
            "
          >{{ flying === 'like' ? '已喜歡' : '已不喜歡' }}</span>
        </div>
      </Transition>

      <div ref="cardRef" class="relative" :style="cardStyle">
        <JobCard :job="job" />

      </div>
    </div>
  </div>
</template>

<style scoped>
.stamp-pop-enter-active {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}
.stamp-pop-enter-from {
  opacity: 0;
  transform: scale(0.4);
}
.stamp-pop-leave-active {
  transition: opacity 0.15s ease;
}
.stamp-pop-leave-to {
  opacity: 0;
}
</style>
