<script lang="ts" setup>
import { ref } from 'vue';
import { useAuthStore } from '../useAuthStore';

const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const isSubmitting = ref(false);

const loginWithEmail = async () => {
  error.value = '';
  isSubmitting.value = true;
  const { error: err } = await authStore.loginWithEmail(email.value, password.value);
  if (err) {
    error.value = err.message;
  }
  isSubmitting.value = false;
};
</script>

<template>
  <div class="flex min-h-[80vh] items-center justify-center">
    <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg dark:bg-[#001f2a]">
      <h1
        class="mb-2 text-center text-2xl font-black tracking-tight text-[#003d92] dark:text-[#e6f6ff]"
      >
        歡迎回來
      </h1>
      <p class="mb-8 text-center text-sm text-[#434653] dark:text-[#c3c6d5]">
        登入您的帳號
      </p>

      <!-- <form class="mb-4 flex flex-col gap-3" @submit.prevent="loginWithEmail">
        <input
          v-model="email"
          autocomplete="email"
          class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] dark:border-gray-600 dark:bg-[#002d3d] dark:text-white"
          placeholder="電子郵件"
          type="email"
          required
        />
        <input
          v-model="password"
          autocomplete="current-password"
          class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#4285F4] focus:ring-1 focus:ring-[#4285F4] dark:border-gray-600 dark:bg-[#002d3d] dark:text-white"
          placeholder="密碼"
          type="password"
          required
        />
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <button
          class="rounded-xl bg-[#003d92] px-6 py-3 font-semibold text-white transition hover:bg-[#0052c2] active:scale-95 disabled:opacity-60"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? '登入中...' : '登入' }}
        </button>
      </form>

      <div class="relative mb-4 flex items-center">
        <div class="flex-1 border-t border-gray-200 dark:border-gray-600" />
        <span class="mx-3 text-sm text-gray-400">或使用社群帳號</span>
        <div class="flex-1 border-t border-gray-200 dark:border-gray-600" />
      </div> -->

      <div class="flex flex-col gap-3">
        <button
          class="flex items-center justify-center gap-3 rounded-xl bg-[#4285F4] px-6 py-3 font-semibold text-white transition hover:bg-[#3367d6] active:scale-95"
          @click="authStore.loginWithGoogle()"
        >
          <svg height="20" viewBox="0 0 48 48" width="20">
            <path
              d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
              fill="#fff"
            />
          </svg>
          使用 Google 登入
        </button>
        <button
          class="flex items-center justify-center gap-3 rounded-xl bg-[#24292F] px-6 py-3 font-semibold text-white transition hover:bg-[#444d56] active:scale-95"
          @click="authStore.loginWithGithub()"
        >
          <svg fill="white" height="20" viewBox="0 0 24 24" width="20">
            <path
              d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.929.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.216.69.825.573C20.565 21.795 24 17.298 24 12c0-6.63-5.37-12-12-12z"
            />
          </svg>
          使用 GitHub 登入
        </button>
      </div>
    </div>
  </div>
</template>
