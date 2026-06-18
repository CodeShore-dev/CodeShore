import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAuthStore } from '../../features/auth/useAuthStore';

export interface NavLink {
  to: string;
  label: string;
  icon: string;
  exact?: boolean;
  requiresEdit?: boolean;
  // when on the exact route, the link is not considered active if this query param is present (e.g. /jobs?tab=like is a sub-view, not the listing)
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
  {
    to: '/companies',
    label: '公司',
    icon: 'apartment',
    exact: false,
  },
  {
    to: '/techs',
    label: '技術',
    icon: 'insights',
    exact: false,
  },
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
];

export function useNavLinks() {
  const route = useRoute();
  const authStore = useAuthStore();

  const navLinks = computed(() =>
    NAV_LINKS.filter(
      link => !link.requiresEdit || authStore.canEdit,
    ),
  );

  const footerLinks = computed(() =>
    navLinks.value.filter(
      link => link.showInFooter !== false,
    ),
  );

  function isActive(link: NavLink) {
    if (link.exact) {
      if (
        link.exactExcludesQuery &&
        route.query[link.exactExcludesQuery]
      )
        return false;
      return route.path === link.to;
    }
    return route.path.startsWith(link.to);
  }

  return { navLinks, footerLinks, isActive };
}
