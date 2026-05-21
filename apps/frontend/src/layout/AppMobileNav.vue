<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAuthStore } from '../features/auth/useAuthStore';

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
  <!-- Mobile bottom nav -->
  <nav
    class="fixed bottom-0 left-0 z-50 flex w-full items-end justify-around border-t border-[#c3c6d5]/15 bg-[#f4faff]/90 px-4 pb-4 backdrop-blur-lg md:hidden dark:bg-[#001f2a]/90"
  >
    <RouterLink
      v-for="link in navLinks"
      :key="link.to"
      :to="link.to"
      class="flex flex-col items-center justify-center p-2 transition"
      :class="
        route.path === link.to
          ? 'text-[#003d92] dark:text-[#a8d4f5]'
          : 'text-[#434653] hover:text-[#003d92] dark:text-[#c3c6d5]'
      "
    >
      <span
        class="material-symbols-outlined transition"
        :style="
          route.path === link.to
            ? 'font-variation-settings: \'FILL\' 1'
            : ''
        "
        >{{ link.icon }}</span
      >
      <span
        class="mt-1 text-sm font-bold tracking-widest "
        >{{ link.label }}</span
      >
    </RouterLink>
  </nav>
</template>

