<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAuthStore } from '../features/auth/useAuthStore';

const route = useRoute();
const authStore = useAuthStore();

const navLinks = computed(() => [
  { to: '/', label: '首頁', icon: 'home', exact: true },
  { to: '/jobs', label: '職缺', icon: 'work', exact: true },
  { to: '/companies', label: '公司', icon: 'apartment', exact: false },
  ...(authStore.canEdit
    ? [
        { to: '/keywords', label: '關鍵字', icon: 'label', exact: false },
        { to: '/admin/jobs', label: '監控', icon: 'monitoring', exact: false },
      ]
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
        (link.exact ? route.path === link.to : route.path.startsWith(link.to))
          ? 'text-[#003d92]'
          : 'text-[#434653] hover:text-[#003d92]'
      "
    >
      <span
        class="material-symbols-outlined transition"
        :style="
          (link.exact ? route.path === link.to : route.path.startsWith(link.to))
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

