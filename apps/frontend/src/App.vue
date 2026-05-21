<script lang="ts" setup>
import AppNavBar from './layout/AppNavBar.vue';
import AppMobileNav from './layout/AppMobileNav.vue';
import AppFooter from './layout/AppFooter.vue';

</script>

<template>
  <div
    class="bg-background font-body text-on-surface min-h-screen"
  >
    <AppNavBar />

    <main
      class="mx-auto flex max-w-7xl flex-col items-center px-4 pt-24 pb-24 lg:px-6 md:pb-12"
    >
      <RouterView />
    </main>

    <AppFooter />

    <AppMobileNav />
  </div>
</template>

<style lang="scss" scoped></style>
