import {
  type RouterScrollBehavior,
  createRouter,
  createWebHistory,
} from 'vue-router';

import { useAuthStore } from '../features/auth/useAuthStore';
import Home from '../features/home/views/Home.vue';

export const PUBLIC_ROUTES = [
  'login',
  'auth-callback',
  'home',
  'techs',
  'techs-combos',
  'methodology',
];

// Project rule: switching pages resets scroll to top. Restore browser
// back/forward position; honour hash deep-links (e.g. /methodology#anchor)
// so external links land on the target section (req 7.4); only reset on an
// actual path change so same-page query updates (filters, drawer,
// pagination) don't jump.
export const scrollBehavior: RouterScrollBehavior = (
  to,
  from,
  savedPosition,
) => {
  if (savedPosition) return savedPosition;
  // Hash deep-link wins over a plain path-change reset so /methodology#anchor
  // scrolls to the section. The top offset clears the fixed nav.
  if (to.hash) return { el: to.hash, top: 80 };
  if (to.path !== from.path) return { top: 0 };
  return false;
};

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior,
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () =>
        import('../features/job/views/JobPreference.vue'),
    },
    {
      path: '/techs',
      name: 'techs',
      component: () =>
        import('../features/techs/views/TechRanking.vue'),
    },
    {
      path: '/techs/combos',
      name: 'techs-combos',
      component: () =>
        import('../features/techs/views/TechCombos.vue'),
    },
    {
      path: '/methodology',
      name: 'methodology',
      component: () =>
        import('../features/methodology/views/Methodology.vue'),
    },
    {
      path: '/companies',
      name: 'companies',
      component: () =>
        import('../features/company/views/CompanyList.vue'),
    },
    {
      path: '/keywords',
      name: 'keywords',
      component: () =>
        import('../features/keyword/views/KeywordGroupManager.vue'),
    },
    {
      path: '/admin/jobs',
      name: 'admin-jobs',
      meta: { adminOnly: true },
      component: () =>
        import('../features/admin/views/JobMonitor.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () =>
        import('../features/auth/views/Login.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () =>
        import('../features/auth/views/AuthCallback.vue'),
    },
  ],
});

router.beforeEach(async to => {
  const authStore = useAuthStore();

  if (authStore.isLoading) {
    await authStore.initAuth();
  }

  if (
    !authStore.isAuthenticated &&
    !PUBLIC_ROUTES.includes(to.name as string)
  ) {
    return { name: 'login' };
  }

  if (authStore.isAuthenticated && to.name === 'login') {
    return { name: 'home' };
  }

  if (to.meta.adminOnly && !authStore.canEdit) {
    return { name: 'home' };
  }
});

export default router;
