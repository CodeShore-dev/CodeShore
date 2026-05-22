<script lang="ts" setup>
import { useRoute } from 'vue-router';

import { useAuthStore } from '../features/auth/useAuthStore';
import { computed } from 'vue';

const route = useRoute();
const authStore = useAuthStore();

const navLinks = computed(() => [
  { to: '/', label: '首頁', exact: true },
  { to: '/jobs', label: '職缺', exact: true },
  { to: '/companies', label: '公司', exact: false },
  ...(authStore.canEdit
    ? [{ to: '/keywords', label: '關鍵字', exact: false }]
    : []),
]);

function isActive(link: { to: string; exact?: boolean; prefQuery?: boolean; query?: Record<string, string> }) {
  if (link.prefQuery) return route.path === link.to && !!route.query.tab;
  if (link.exact && link.to === '/jobs') return route.path === link.to && !route.query.tab;
  if (link.exact) return route.path === link.to;
  return route.path.startsWith(link.to);
}
</script>

<template>
  <nav
    class="w-full bg-[#f4faff]/80 shadow-[0_1px_0_#c3c6d5] backdrop-blur-xl"
  >
    <div
      class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4"
    >
      <RouterLink
        to="/"
        class="text-xl font-black tracking-[-0.04em] text-[#003d92] dark:text-[#e6f6ff]"
      >
        Code<span class="text-[#fd7700]">Shore</span>
      </RouterLink>

      <!-- Desktop nav links -->
      <div class="hidden items-center gap-1 md:flex">
        <RouterLink
          v-for="link in navLinks"
          :key="link.label"
          :to="{ path: link.to }"
          class="rounded-full px-4 py-2 text-sm font-bold transition"
          :class="
            isActive(link)
              ? 'bg-[#003d92]/10 text-[#003d92]'
              : 'text-[#434653] hover:bg-[#001f2a]/4 hover:text-[#001f2a]'
          "
        >
          {{ link.label }}
        </RouterLink>
      </div>

      <div class="flex items-center gap-3">
        <template
          v-if="authStore.isAuthenticated && authStore.user"
        >
          <span
            class="hidden text-sm text-[#434653] dark:text-[#c3c6d5] md:inline"
          >
            {{ authStore.user.email }}
          </span>
          <button
            class="rounded-lg bg-[#003d92] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#002a6b] active:scale-95"
            @click="authStore.logout()"
          >
            登出
          </button>
        </template>
        <template v-else-if="!authStore.isLoading">
          <RouterLink
            class="rounded-lg bg-[#003d92] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#002a6b] active:scale-95"
            to="/login"
          >
            登入
          </RouterLink>
        </template>
      </div>
    </div>
  </nav>
</template>
