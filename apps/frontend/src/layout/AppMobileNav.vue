<script lang="ts" setup>
import { useNavLinks } from './composables/useNavLinks';

const { navLinks, isActive } = useNavLinks();
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
        isActive(link)
          ? 'text-[#003d92]'
          : 'text-[#434653] hover:text-[#003d92]'
      "
    >
      <span
        class="material-symbols-outlined transition"
        :style="
          isActive(link)
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

