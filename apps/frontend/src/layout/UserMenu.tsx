import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

export interface UserMenuProps {
  email: string;
  onLogout: () => void;
}

// 右上角使用者下拉選單。實作結構直接比照 MoreNavMenu.tsx:
// useState(open) + containerRef + mousedown 監聽點外部關閉、
// absolute/relative 定位,不使用 portal(header 無巢狀捲動/overflow 限制)。
export function UserMenu({ email, onLogout }: UserMenuProps) {
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

  const handleLogout = (): void => {
    onLogout();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={email}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-full p-2 text-[#434653] transition hover:bg-[#001f2a]/4 hover:text-[#001f2a]"
      >
        <span className="material-symbols-outlined text-2xl">
          account_circle
        </span>
        <span className="material-symbols-outlined text-base">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-[#c3c6d5]/40 bg-white p-1.5 shadow-[0_12px_40px_rgba(0,31,42,0.18)]">
          <div className="truncate px-3 py-2 text-sm text-[#434653]">
            {email}
          </div>

          <Link
            to="/jobs/watchlist"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#f4faff] hover:text-[#001f2a]"
          >
            關注篩選
          </Link>

          <Link
            to="/jobs?tab=like"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#f4faff] hover:text-[#001f2a]"
          >
            我的喜歡/不喜歡
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#434653] transition hover:bg-[#f4faff] hover:text-[#001f2a]"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}
