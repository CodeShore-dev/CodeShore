import { useEffect, useRef } from 'react';

// 超過此位移（px）才視為「拖曳」而非「點擊」，避免點節點時被誤判為拖動。
const DRAG_THRESHOLD = 5;

/**
 * 讓可水平捲動的容器支援滑鼠「按住拖曳」來移動捲軸（grab/grabbing），
 * 補強原本只能用滾輪／觸控板捲動的關係圖畫布。
 *
 * - 只接管滑鼠（pointerType === 'mouse'）；觸控仍走瀏覽器原生捲動，不重複處理。
 * - 內容未溢出（無可捲動空間）時不啟用，游標也不顯示成可拖曳。
 * - 拖曳結束時抑制隨之而來的 click，避免移動畫面時誤觸節點詳情。
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }

    let active = false;
    let dragged = false;
    let startX = 0;
    let startScrollLeft = 0;

    const scrollable = (): boolean => el.scrollWidth > el.clientWidth;

    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !scrollable()) {
        return;
      }
      active = true;
      dragged = false;
      startX = event.clientX;
      startScrollLeft = el.scrollLeft;
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!active) {
        return;
      }
      const dx = event.clientX - startX;
      if (!dragged && Math.abs(dx) < DRAG_THRESHOLD) {
        return;
      }
      dragged = true;
      el.scrollLeft = startScrollLeft - dx;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const endDrag = (): void => {
      active = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    const onClick = (event: MouseEvent): void => {
      if (dragged) {
        event.stopPropagation();
        event.preventDefault();
        dragged = false;
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    // capture 階段攔截，確保在節點按鈕的 onClick 之前先吃掉拖曳尾端的點擊。
    el.addEventListener('click', onClick, true);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      el.removeEventListener('click', onClick, true);
    };
  }, []);

  return ref;
}
