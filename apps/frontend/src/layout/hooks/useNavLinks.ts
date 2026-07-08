import { useLocation } from 'react-router';

import { useCanEdit } from '../../features/auth/authStore';

export interface NavLink {
  to: string;
  label: string;
  icon: string;
  exact?: boolean;
  requiresEdit?: boolean;
  // When on the exact route, the link is not active if this query param is
  // present (e.g. /jobs?tab=like is a sub-view, not the listing).
  exactExcludesQuery?: string;
  showInFooter?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { to: '/', label: '首頁', icon: 'home', exact: true },
  {
    to: '/jobs',
    label: '職缺',
    icon: 'work',
    exact: true,
    exactExcludesQuery: 'tab',
  },
  { to: '/companies', label: '公司', icon: 'apartment', exact: false },
  { to: '/techs', label: '技術', icon: 'insights', exact: false },
  {
    to: '/keywords',
    label: '關鍵字',
    icon: 'label',
    exact: false,
    requiresEdit: true,
  },
  {
    to: '/admin/jobs',
    label: '監控',
    icon: 'monitoring',
    exact: false,
    requiresEdit: true,
    showInFooter: false,
  },
  {
    to: '/admin/ai-suggestions',
    label: 'AI 建議審核',
    icon: 'auto_awesome',
    exact: false,
    requiresEdit: true,
    showInFooter: false,
  },
];

export function useNavLinks() {
  const location = useLocation();
  const canEdit = useCanEdit();

  const navLinks = NAV_LINKS.filter(
    link => !link.requiresEdit || canEdit,
  );

  const footerLinks = navLinks.filter(
    link => link.showInFooter !== false,
  );

  const isActive = (link: NavLink): boolean => {
    if (link.exact) {
      if (
        link.exactExcludesQuery &&
        new URLSearchParams(location.search).get(link.exactExcludesQuery)
      ) {
        return false;
      }
      return location.pathname === link.to;
    }
    return location.pathname.startsWith(link.to);
  };

  return { navLinks, footerLinks, isActive };
}
