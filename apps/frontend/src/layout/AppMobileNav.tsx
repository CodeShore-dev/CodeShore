import { Link } from 'react-router';

import { useNavLinks } from './hooks/useNavLinks';

export function AppMobileNav() {
  const { navLinks, isActive } = useNavLinks();

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-end justify-around border-t border-[#c3c6d5]/15 bg-[#f4faff]/90 px-4 pb-4 backdrop-blur-lg md:hidden">
      {navLinks.map(link => (
        <Link
          key={link.to}
          to={link.to}
          className={`flex flex-col items-center justify-center p-2 transition ${
            isActive(link)
              ? 'text-[#003d92]'
              : 'text-[#434653] hover:text-[#003d92]'
          }`}
        >
          <span
            className="material-symbols-outlined transition"
            style={
              isActive(link)
                ? { fontVariationSettings: "'FILL' 1" }
                : undefined
            }
          >
            {link.icon}
          </span>
          <span className="mt-1 text-sm font-bold tracking-widest">
            {link.label}
          </span>
        </Link>
      ))}
      <Link
        to="/methodology"
        className="flex flex-col items-center justify-center p-2 text-[#434653] transition hover:text-[#003d92]"
      >
        <span className="material-symbols-outlined transition">policy</span>
        <span className="mt-1 text-sm font-bold tracking-widest">
          公開透明
        </span>
      </Link>
    </nav>
  );
}
