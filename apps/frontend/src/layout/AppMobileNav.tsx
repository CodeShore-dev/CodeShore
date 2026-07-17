import { Link } from 'react-router';

import { useNavLinks } from './hooks/useNavLinks';
import { MoreNavMenu } from './MoreNavMenu';

export function AppMobileNav() {
  const { navLinks, moreLinks, isActive } = useNavLinks();

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-end justify-around border-t border-[#c3c6d5]/15 bg-[#f4faff]/90 px-4 pb-4 backdrop-blur-lg md:hidden">
      {navLinks.map(link => (
        <Link
          key={link.to}
          to={link.to}
          className={`flex min-w-0 flex-col items-center justify-center gap-0.5 p-1 transition ${
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
          <span className="whitespace-nowrap text-[10px] leading-none font-medium">
            {link.label}
          </span>
        </Link>
      ))}
      <Link
        to="/methodology"
        className="flex min-w-0 flex-col items-center justify-center gap-0.5 p-1 text-[#434653] transition hover:text-[#003d92]"
      >
        <span className="material-symbols-outlined transition">policy</span>
        <span className="whitespace-nowrap text-[10px] leading-none font-medium">
          公開透明
        </span>
      </Link>
      <MoreNavMenu links={moreLinks} isActive={isActive} variant="mobile" />
    </nav>
  );
}
