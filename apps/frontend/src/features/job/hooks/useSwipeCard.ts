import { type CSSProperties, type PointerEvent, useRef, useState } from 'react';

const SWIPE_THRESHOLD = 120;
// Minimum travel before we commit to an axis. Below this, a touch could
// still be either a tap, a vertical scroll, or the start of a horizontal
// swipe, so we hold off judging intent.
const AXIS_LOCK_THRESHOLD = 10;

interface UseSwipeCardOptions {
  canLike: () => boolean;
  canDislike: () => boolean;
  onCommit: (preference: 'like' | 'dislike') => void;
}

// Swipe-to-like/dislike card gesture (task 7.5). React port of the VueUse
// usePointerSwipe composable: touch/pen only (a mouse drag must stay free for
// selecting description text used in admin keyword tagging); commits past a
// 120px threshold with a fly-out animation.
//
// Vertical page scrolling shares the same touch gesture as the horizontal
// swipe, so once movement exceeds AXIS_LOCK_THRESHOLD we lock onto whichever
// axis (horizontal vs vertical) has moved further. A vertical lock releases
// the gesture back to the browser's native scroll instead of tracking offsetX.
type Axis = 'none' | 'horizontal' | 'vertical';

export function useSwipeCard(options: UseSwipeCardOptions) {
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<'like' | 'dislike' | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<Axis>('none');
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
    startY.current = e.clientY;
    axis.current = 'none';
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== activePointer.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (axis.current === 'none') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_THRESHOLD) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (axis.current === 'vertical') {
        // Let the page scroll natively; stop tracking this gesture.
        setDragging(false);
        activePointer.current = null;
        return;
      }
    }

    if (axis.current === 'horizontal') {
      e.preventDefault();
      setOffsetX(dx);
    }
  };

  const endDrag = (e: PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    const dx = e.clientX - startX.current;
    const wasHorizontal = axis.current === 'horizontal';
    setDragging(false);
    activePointer.current = null;
    axis.current = 'none';
    if (wasHorizontal && dx >= SWIPE_THRESHOLD && options.canLike()) {
      commit('like');
    } else if (wasHorizontal && dx <= -SWIPE_THRESHOLD && options.canDislike()) {
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

