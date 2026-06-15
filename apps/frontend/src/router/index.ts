import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '../features/auth/useAuthStore';
import Home from '../features/home/views/Home.vue';

const PUBLIC_ROUTES = ['login', 'auth-callback', 'home'];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
      path: '/companies',
      name: 'companies',
      component: () =>
        import('../features/company/views/CompanyList.vue'),
    },
    {
      path: '/keywords',
      name: 'keywords',
      component: () =>
        import(
          '../features/keyword/views/KeywordGroupManager.vue'
        ),
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
