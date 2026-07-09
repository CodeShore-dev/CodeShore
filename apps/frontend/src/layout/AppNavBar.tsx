import { Link } from 'react-router';

import { useAuthStore, useIsAuthenticated } from '../features/auth/authStore';
import { AdminViewToggle } from '../features/auth/components/AdminViewToggle';
import { useNavLinks } from './hooks/useNavLinks';

export function AppNavBar() {
  const { navLinks, isActive } = useNavLinks();
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthStore(state => state.isLoading);
  const logout = useAuthStore(state => state.logout);

  return (
    <nav className="w-full bg-[#f4faff]/80 shadow-[0_1px_0_#c3c6d5] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link
          to="/"
          className="text-xl font-black tracking-[-0.04em] text-[#003d92]"
        >
          Code<span className="text-[#fd7700]">Shore</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map(link => (
            <Link
              key={link.label}
              to={link.to}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                isActive(link)
                  ? 'bg-[#003d92]/10 text-[#003d92]'
                  : 'text-[#434653] hover:bg-[#001f2a]/4 hover:text-[#001f2a]'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/methodology"
            className="rounded-full px-4 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#001f2a]/4 hover:text-[#001f2a]"
          >
            公開透明
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <AdminViewToggle />
          {isAuthenticated && user ? (
            <>
              <span className="hidden text-sm text-[#434653] md:inline">
                {user.email}
              </span>
              <button
                type="button"
                className="rounded-lg bg-[#003d92] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#002a6b] active:scale-95"
                onClick={() => logout()}
              >
                登出
              </button>
            </>
          ) : (
            !isLoading && (
              <Link
                className="rounded-lg bg-[#003d92] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#002a6b] active:scale-95"
                to="/login"
              >
                登入
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
