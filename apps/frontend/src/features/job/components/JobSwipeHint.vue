<script setup lang="ts">
const emit = defineEmits<{ dismiss: [] }>();
</script>

<template>
  <div
    class="relative mb-3 flex items-center gap-2 rounded-xl border border-[#c3c6d5] bg-white py-3 pt-4 pb-8 shadow-[0_24px_40px_rgba(0,31,42,0.06)] md:hidden"
  >
    <div
      class="flex flex-1 items-center justify-center gap-5 pr-5"
    >
      <div
        class="flex flex-col items-center gap-1 text-[#ba1a1a]"
      >
        <span class="flex items-center">
          <span
            class="material-symbols-outlined animate-bounce-left"
            >chevron_left</span
          >
          <span
            class="material-symbols-outlined text-4xl!"
            style="font-variation-settings: 'FILL' 1"
            >close</span
          >
        </span>
        <span
          class="text-[11px] font-bold whitespace-nowrap"
          >左滑不喜歡</span
        >
      </div>

      <span
        class="text-[11px] font-bold tracking-widest text-[#434653]"
        >滑動職缺卡片</span
      >

      <div
        class="flex flex-col items-center gap-1 text-[#003d92]"
      >
        <span class="flex items-center">
          <span
            class="material-symbols-outlined text-4xl!"
            style="font-variation-settings: 'FILL' 1"
            >favorite</span
          >
          <span
            class="material-symbols-outlined animate-bounce-right"
            >chevron_right</span
          >
        </span>
        <span
          class="text-[11px] font-bold whitespace-nowrap"
          >右滑喜歡</span
        >
      </div>
    </div>
    <button
      class="absolute right-2 bottom-2 cursor-pointer text-[12px] text-[#434653] hover:text-[#001f2a]"
      @click="emit('dismiss')"
    >
      我知道了
    </button>
  </div>
</template>

<style scoped>
.hint-fade-enter-active,
.hint-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
