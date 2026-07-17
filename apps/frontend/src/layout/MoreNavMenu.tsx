import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import type { NavLink } from './hooks/useNavLinks';

interface MoreNavMenuProps {
  links: NavLink[];
  isActive: (link: NavLink) => boolean;
  variant: 'desktop' | 'mobile';
}

// "更多" dropdown grouping the editor/admin-only nav links (keeps the
// primary nav row down to the 4 always-visible links). No generic
// dropdown/menu component exists elsewhere in this repo (checked
// `src/components/` and the two feature popovers, `JobTechPopover.tsx`/
// `IconSourcePopover.tsx`, which portal to `document.body` with
// anchor-position tracking for a floating card -- overkill for a simple
// button-anchored menu), so this is a small self-contained
// open/closed + click-outside implementation instead of reusing a portal.
// Renders nothing when `links` is empty (a non-admin has zero more-links,
// matching this dropdown's pre-reorg equivalent visibility).
export function MoreNavMenu({ links, isActive, variant }: MoreNavMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (links.length === 0) return null;

  const anyActive = links.some(isActive);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={
          variant === 'desktop'
            ? `flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold transition ${
                anyActive
                  ? 'bg-[#003d92]/10 text-[#003d92]'
                  : 'text-[#434653] hover:bg-[#001f2a]/4 hover:text-[#001f2a]'
              }`
            : `flex min-w-0 flex-col items-center justify-center gap-0.5 p-1 transition ${
                anyActive ? 'text-[#003d92]' : 'text-[#434653] hover:text-[#003d92]'
              }`
        }
      >
        {variant === 'desktop' ? (
          <>
            更多
            <span className="material-symbols-outlined text-base">
              {open ? 'expand_less' : 'expand_more'}
            </span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined transition">
              more_horiz
            </span>
            <span className="whitespace-nowrap text-[10px] leading-none font-medium">
              更多
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 z-50 w-44 rounded-xl border border-[#c3c6d5]/40 bg-white p-1.5 shadow-[0_12px_40px_rgba(0,31,42,0.18)] ${
            variant === 'desktop' ? 'top-full mt-2' : 'bottom-full mb-2'
          }`}
        >
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                isActive(link)
                  ? 'bg-[#003d92]/10 text-[#003d92]'
                  : 'text-[#434653] hover:bg-[#f4faff] hover:text-[#001f2a]'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {link.icon}
              </span>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
