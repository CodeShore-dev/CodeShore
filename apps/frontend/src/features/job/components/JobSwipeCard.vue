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
  dragging,
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
</script>

<template>
  <div class="relative w-full">
    <Transition name="hint-fade">
      <JobSwipeHint
        v-if="!hintDismissed"
        @dismiss="dismissHint"
      />
    </Transition>

    <div ref="cardRef" class="relative" :style="cardStyle">
      <JobCard :job="job" />

      <div
        class="pointer-events-none absolute top-8 left-8 -rotate-12 rounded-lg border-4 border-[#003d92] bg-white/80 px-4 py-1 text-2xl font-black tracking-widest text-[#003d92]"
        :style="{ opacity: likeOpacity }"
      >
        喜歡
      </div>
      <div
        class="pointer-events-none absolute top-8 right-8 rotate-12 rounded-lg border-4 border-[#ba1a1a] bg-white/80 px-4 py-1 text-2xl font-black tracking-widest text-[#ba1a1a]"
        :style="{ opacity: dislikeOpacity }"
      >
        不喜歡
      </div>
    </div>
  </div>
</template>
