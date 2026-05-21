<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { supabase } from '../../../lib/supabase';

const router = useRouter();
const error = ref<string | null>(null);

onMounted(async () => {
  const { data, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    error.value = sessionError.message;
    return;
  }

  if (data.session) {
    await router.replace({ name: 'home' });
  } else {
    error.value = '登入失敗，請再試一次。';
    setTimeout(() => router.replace({ name: 'login' }), 2000);
  }
});
</script>

<template>
  <div class="flex min-h-[80vh] items-center justify-center">
    <div
      v-if="error"
      class="text-center text-red-500"
    >
      {{ error }}
    </div>
    <div
      v-else
      class="text-center text-[#003d92] dark:text-[#e6f6ff]"
    >
      <div
        class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#003d92] border-t-transparent"
      />
      正在登入...
    </div>
  </div>
</template>
