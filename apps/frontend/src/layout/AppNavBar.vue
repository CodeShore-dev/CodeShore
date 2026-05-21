<script lang="ts" setup>
import { useRoute } from 'vue-router';

import { useAuthStore } from '../features/auth/useAuthStore';
import { computed } from 'vue';

const route = useRoute();
const authStore = useAuthStore();

const navLinks = computed(() => [
  { to: '/jobs', label: '職缺', icon: 'work' },
  { to: '/companies', label: '公司', icon: 'apartment' },
  ...(authStore.canEdit
    ? [{ to: '/keywords', label: '關鍵字', icon: 'label' }]
    : []),
]);
</script>

<template>
  <nav
    class="fixed top-0 z-50 w-full bg-[#f4faff]/80 shadow-sm backdrop-blur-xl dark:bg-[#001f2a]/80 dark:shadow-none"
  >
    <div
      class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4"
    >
      <RouterLink
        to="/"
        class="text-2xl font-black tracking-tighter text-[#003d92] dark:text-[#e6f6ff]"
      >
        碼的上岸了
      </RouterLink>

      <!-- Desktop nav links -->
      <div class="hidden items-center gap-1 md:flex">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
          :class="
            route.path === link.to
              ? 'bg-[#003d92]/10 text-[#003d92] dark:bg-[#003d92]/30 dark:text-[#a8d4f5]'
              : 'text-[#434653] hover:bg-[#e6f6ff] hover:text-[#003d92] dark:text-[#c3c6d5] dark:hover:bg-[#003d92]/20'
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
