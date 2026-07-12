import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useActiveSection } from '../composables/useActiveSection';

export interface MethodologyNavItem {
  id: string;
  title: string;
}

interface MethodologySectionNavProps {
  items: readonly MethodologyNavItem[];
}

// Floating "jump to section" list for the long methodology page. Only wide
// (lg+) screens get the always-visible dot rail pinned to the right edge —
// below that, down to mobile, everything collapses to a single FAB (top-left,
// under the fixed header) that opens a tappable sheet.
export function MethodologySectionNav({ items }: MethodologySectionNavProps) {
  const ids = items.map(item => item.id);
  const activeId = useActiveSection(ids);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (sheetRef.current?.contains(target) || fabRef.current?.contains(target)) {
        return;
      }
      setMobileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  if (items.length === 0) return null;

  return (
    <>
      <nav
        aria-label="本頁區塊導覽"
        className="fixed top-1/2 right-3 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex"
      >
        {items.map(item => {
          const isActive = item.id === activeId;
          return (
            <Link
              key={item.id}
              to={`#${item.id}`}
              aria-current={isActive || undefined}
              className="group flex items-center gap-2"
            >
              <span
                className={`rounded-md bg-white px-2 py-1 text-xs font-bold whitespace-nowrap shadow-lg ring-1 ring-[#c3c6d5] transition-opacity group-hover:opacity-100 ${
                  isActive ? 'text-[#003d92]' : 'text-[#434653]'
                }`}
              >
                {item.title}
              </span>
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#003d92] transition-colors ${
                  isActive ? 'bg-[#003d92]' : 'bg-white group-hover:bg-[#d9f2ff]'
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="fixed top-24 left-4 z-40 md:top-32 lg:hidden">
        {mobileOpen && (
          <div
            ref={sheetRef}
            role="dialog"
            aria-label="本頁區塊導覽"
            className="absolute top-14 left-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-[#c3c6d5] bg-white p-2 shadow-2xl"
          >
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto list-none">
              {items.map(item => {
                const isActive = item.id === activeId;
                return (
                  <li key={item.id}>
                    <Link
                      to={`#${item.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                        isActive ? 'bg-[#f4faff] text-[#003d92]' : 'text-[#434653] hover:bg-[#f4faff]'
                      }`}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <button
          ref={fabRef}
          type="button"
          aria-label="切換頁面區塊"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(open => !open)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#003d92]/60 text-white shadow-2xl backdrop-blur-sm transition-colors transition-transform hover:bg-[#003d92]/85 active:scale-95"
        >
          <span className="material-symbols-outlined">list</span>
        </button>
      </div>
    </>
  );
}
