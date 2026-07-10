import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useMetricExplanation } from '../composables/useMetricExplanation';
import type { MetricKey } from '../content/types';

interface InfoHintProps {
  metric: MetricKey;
  ariaLabel?: string;
}

// Methodology metric explanation popover (shared by Home and the Methodology
// page). Ported from InfoHint.vue: @vueuse onClickOutside/useEventListener are
// replaced by document listeners; the popover is centered in the viewport
// rather than anchored to the trigger.
export function InfoHint({
  metric,
  ariaLabel = '查看此區資料如何計算',
}: InfoHintProps) {
  const { explanation, deepLink } = useMetricExplanation(metric);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const closePopover = (restoreFocus = true): void => {
    setOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const toggle = (): void => {
    if (open) {
      closePopover();
    } else {
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      closePopover(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closePopover();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!explanation) return null;

  return (
    <span className="inline-flex">
      <span className="relative inline-flex">
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-[#c3c6d5] bg-[#f4faff] text-xs font-bold text-[#003d92] transition-colors hover:bg-[#d9f2ff] focus:ring-2 focus:ring-[#003d92] focus:outline-none"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={toggle}
        >
          <span className="relative top-px">?</span>
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-48 bg-black/30"
              aria-hidden="true"
              onClick={() => closePopover(false)}
            />
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={ariaLabel}
              className="fixed top-1/2 left-1/2 z-49 max-h-[80vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[#c3c6d5] bg-white p-4 text-left shadow-2xl sm:w-[400px] sm:max-w-[400px]"
            >
              <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#e8eaf0] pb-2.5">
                <p className="text-base font-black tracking-tight text-[#001f2a]">
                  {explanation.title}
                </p>
                <button
                  type="button"
                  className="-m-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9398a6] transition-colors hover:bg-[#f4faff] hover:text-[#001f2a] focus:ring-2 focus:ring-[#003d92] focus:outline-none"
                  aria-label="關閉"
                  onClick={() => closePopover()}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '18px' }}
                  >
                    close
                  </span>
                </button>
              </div>
              {explanation.intro && (
                <p className="mb-3 text-sm leading-relaxed text-[#5b6070]">
                  {explanation.intro}
                </p>
              )}
              <ul className="space-y-3">
                {explanation.items.map(item => (
                  <li key={item.name}>
                    <p className="text-sm font-bold text-[#001f2a]">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed font-normal text-[#5b6070]">
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ul>
              {(explanation.note || deepLink) && (
                <div className="mt-4 space-y-2 border-t border-[#e8eaf0] pt-3">
                  {explanation.note && (
                    <p className="text-xs leading-relaxed text-[#9398a6]">
                      {explanation.note}
                    </p>
                  )}
                  {deepLink && (
                    <Link
                      to={deepLink}
                      className="inline-flex items-center text-sm font-bold text-[#003d92] underline transition-colors hover:text-[#001f2a]"
                    >
                      查看完整推導
                    </Link>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </span>
    </span>
  );
}
