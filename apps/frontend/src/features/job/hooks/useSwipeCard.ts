import { type CSSProperties, type PointerEvent, useRef, useState } from 'react';

const SWIPE_THRESHOLD = 120;

interface UseSwipeCardOptions {
  canLike: () => boolean;
  canDislike: () => boolean;
  onCommit: (preference: 'like' | 'dislike') => void;
}

// Swipe-to-like/dislike card gesture (task 7.5). React port of the VueUse
// usePointerSwipe composable: touch/pen only (a mouse drag must stay free for
// selecting description text used in admin keyword tagging); commits past a
// 120px threshold with a fly-out animation.
export function useSwipeCard(options: UseSwipeCardOptions) {
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<'like' | 'dislike' | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const activePointer = useRef<number | null>(null);

  const commit = (preference: 'like' | 'dislike') => {
    setFlying(preference);
    setTimeout(() => {
      options.onCommit(preference);
      setFlying(null);
    }, 250);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    activePointer.current = e.pointerId;
    startX.current = e.clientX;
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== activePointer.current) return;
    setOffsetX(e.clientX - startX.current);
  };

  const endDrag = (e: PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    const dx = e.clientX - startX.current;
    setDragging(false);
    activePointer.current = null;
    if (dx >= SWIPE_THRESHOLD && options.canLike()) {
      commit('like');
    } else if (dx <= -SWIPE_THRESHOLD && options.canDislike()) {
      commit('dislike');
    }
    setOffsetX(0);
  };

  const progress = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1);
  const likeOpacity = offsetX > 0 ? progress : 0;
  const dislikeOpacity = offsetX < 0 ? progress : 0;

  const cardStyle: CSSProperties = flying
    ? {
        transform: `translateX(${(flying === 'like' ? 1 : -1) * 160}%)`,
        opacity: 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }
    : {
        transform: `translateX(${dragging ? offsetX : 0}px)`,
        transition: dragging ? 'none' : 'transform 0.25s ease',
      };

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    cardStyle,
    commit,
    dragging,
    flying,
    likeOpacity,
    dislikeOpacity,
  };
}

