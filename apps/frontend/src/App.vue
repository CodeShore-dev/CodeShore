<script lang="ts" setup>
import AppNavBar from './layout/AppNavBar.vue';
import AppMobileNav from './layout/AppMobileNav.vue';
import AppFooter from './layout/AppFooter.vue';

</script>

<template>
  <div
    class="bg-background font-body text-on-surface min-h-screen"
  >
    <!-- Fixed compound header: disclosure strip + nav -->
    <div class="fixed top-0 z-50 w-full">
      <div class="hidden md:block bg-[#001f2a] text-[#f4faff] text-xs font-bold tracking-wider">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-1.5">
          <span>
            <span class="text-[#fd7700]">● </span>
            我們不收履歷，也不是另一個職缺平台。爬完資料、做完分析後，把你送回 104 / Cake 投履歷。
          </span>
          <span class="font-medium text-white/50">資料每日 00:00 自動更新</span>
        </div>
      </div>
      <AppNavBar />
    </div>

    <!-- pt accounts for nav only on mobile, strip + nav on md+ -->
    <main
      class="mx-auto flex max-w-7xl flex-col items-center px-4 pt-14 pb-24 lg:px-6 md:pt-27 md:pb-12"
    >
      <RouterView />
    </main>

    <AppFooter />

    <AppMobileNav />
  </div>
</template>

<style lang="scss" scoped></style>
