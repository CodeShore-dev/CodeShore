<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue';

import { useHomeStore } from '../useHomeStore';

const store = useHomeStore();

const cycleItems = [
  { is: '多方位檢索職缺', isNot: '求職投履歷平台' },
  { is: '分析薪資與技術趨勢', isNot: '人才媒合平台' },
  { is: '一窺大頭公司的技術', isNot: '履歷優化工具' },
];

const currentIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    currentIndex.value =
      (currentIndex.value + 1) % cycleItems.length;
  }, 3000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <section class="border-b border-[#c3c6d5] py-10">
    <h1
      class="m-0 leading-[0.92] font-black tracking-tighter text-[#001f2a]"
      style="font-size: clamp(3.5rem, 8vw, 6rem)"
    >
      <span class="text-[#003d92]">碼的</span>，<br />
      <span class="text-[#fd7700]">上岸</span>了！
    </h1>
    <div
      class="mt-8 grid grid-cols-1 items-end gap-12 md:grid-cols-[1.4fr_1fr]"
    >
      <div
        class="m-0 max-w-140 text-xl font-medium text-[#001f2a]"
      >
        <div class="flex items-center leading-snug gap-2">
          <span>我們可以讓你</span>
          <span class="cycle-slot">
            <Transition name="slide-up">
              <strong
                :key="currentIndex"
                class="cycle-text font-black text-[#003d92]"
              >
                {{ cycleItems[currentIndex].is }}
              </strong>
            </Transition>
            <strong
              class="cycle-ghost font-black"
              aria-hidden="true"
              >工程師求職市場分析站</strong
            >
          </span>
        </div>
        <div class="flex items-center leading-snug gap-2">
          <span>但不是另一個</span>
          <span class="cycle-slot">
            <Transition name="slide-up">
              <del
                :key="currentIndex"
                class="cycle-text text-[#fd7700]"
              >
                {{ cycleItems[currentIndex].isNot }}
              </del>
            </Transition>
            <del class="cycle-ghost" aria-hidden="true"
              >盲目投履歷工具</del
            >
          </span>
        </div>
        <p class="mt-4 mb-0 leading-relaxed">
          我們爬完台灣知名人力銀行的工程師職缺，告訴你哪些技術組合
          真的有好工作、薪水範圍長什麼樣。
        </p>
      </div>
      <div class="border-l-4 border-[#003d92] pl-5">
        <div
          class="leading-none font-black tracking-[-0.03em] text-[#003d92] tabular-nums"
          style="font-size: clamp(2rem, 4vw, 3.25rem)"
        >
          {{ store.jobCountText.total }}
        </div>
        <div
          class="mt-1 text-sm font-bold tracking-widest text-[#434653]"
        >
          個機會 · 就在今天
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cycle-slot {
  display: inline-block;
  position: relative;
  overflow: hidden;
}

.cycle-text {
  position: absolute;
  bottom: 0;
  left: 0;
  white-space: nowrap;
}

.cycle-ghost {
  visibility: hidden;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>

