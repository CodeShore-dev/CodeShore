<script lang="ts" setup>
import { useAuthStore } from '../features/auth/useAuthStore';
import { useNavLinks } from './composables/useNavLinks';

const authStore = useAuthStore();
const { navLinks, isActive } = useNavLinks();
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
        <RouterLink
          :to="{ name: 'methodology' }"
          class="rounded-full px-4 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#001f2a]/4 hover:text-[#001f2a]"
        >
          公開透明
        </RouterLink>
      </div>

      <div class="flex items-center gap-3">
        <template
          v-if="authStore.isAuthenticated && authStore.user"
        >
          <span
            class="hidden text-sm text-[#434653] md:inline dark:text-[#c3c6d5]"
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
