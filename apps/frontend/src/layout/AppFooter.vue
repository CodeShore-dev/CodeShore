<script lang="ts" setup>
const version = import.meta.env.VITE_APP_VER
</script>

<template>
  <footer
    class="w-full bg-[#e6f6ff] px-8 py-12 dark:bg-[#001f2a]"
  >
    <div
      class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row"
    >
      <div class="font-bold text-[#003d92]"></div>
      <div
        class="flex gap-8 font-['Inter'] text-sm text-[#434653] dark:text-[#c3c6d5]"
      >
        <a
          class="transition-colors hover:text-[#fd7700]"
          href="#"
        >{{version}}</a>
      </div>
    </div>
  </footer>
</template>
