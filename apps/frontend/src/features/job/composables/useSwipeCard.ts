import {
  useEventListener,
  usePointerSwipe,
} from '@vueuse/core';
import { computed, ref } from 'vue';

const SWIPE_THRESHOLD = 120;

export function useSwipeCard(options: {
  canLike: () => boolean;
  canDislike: () => boolean;
  onCommit: (preference: 'like' | 'dislike') => void;
}) {
  const cardRef = ref<HTMLElement | null>(null);
  const dragging = ref(false);
  const flying = ref<'like' | 'dislike' | null>(null);

  const commit = (preference: 'like' | 'dislike') => {
    flying.value = preference;
    setTimeout(() => options.onCommit(preference), 250);
  };

  const { distanceX, distanceY } = usePointerSwipe(
    cardRef,
    {
      threshold: SWIPE_THRESHOLD,
      // Swipe-to-like/dislike is a touch/pen gesture only — a mouse
      // pointer capture would otherwise break drag-to-select text in
      // the job description (used for admin keyword tagging).
      pointerTypes: ['touch', 'pen'],
      onSwipeStart: () => {
        dragging.value = true;
      },
      onSwipeEnd: (_e, direction) => {
        if (direction === 'right' && options.canLike()) {
          commit('like');
        } else if (
          direction === 'left' &&
          options.canDislike()
        ) {
          commit('dislike');
        }
      },
    },
  );

  // usePointerSwipe only fires onSwipeEnd once the threshold was
  // exceeded; track release ourselves so small/aborted drags still
  // reset and snap the card back to center.
  useEventListener(
    cardRef,
    ['pointerup', 'pointercancel'],
    () => {
      dragging.value = false;
    },
  );

  const offsetX = computed(() =>
    dragging.value ? -distanceX.value : 0,
  );
  const offsetY = computed(() =>
    dragging.value ? -distanceY.value * 0.15 : 0,
  );
  const rotate = computed(() => offsetX.value / 18);

  const progress = computed(() =>
    Math.min(Math.abs(offsetX.value) / SWIPE_THRESHOLD, 1),
  );
  const likeOpacity = computed(() =>
    offsetX.value > 0 ? progress.value : 0,
  );
  const dislikeOpacity = computed(() =>
    offsetX.value < 0 ? progress.value : 0,
  );

  const cardStyle = computed(() => {
    if (flying.value) {
      const sign = flying.value === 'like' ? 1 : -1;
      return {
        transform: `translate(${sign * 160}%, -10%) rotate(${sign * 20}deg)`,
        opacity: '0',
        transition:
          'transform 0.25s ease, opacity 0.25s ease',
      };
    }
    return {
      transform: `translate(${offsetX.value}px, ${offsetY.value}px) rotate(${rotate.value}deg)`,
      transition: dragging.value
        ? 'none'
        : 'transform 0.25s ease',
    };
  });

  return {
    cardRef,
    cardStyle,
    dragging,
    likeOpacity,
    dislikeOpacity,
  };
}
