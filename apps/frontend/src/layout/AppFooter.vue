<script lang="ts" setup>
import { useNavLinks } from './composables/useNavLinks';

const version = import.meta.env.VITE_APP_VER;
const { footerLinks } = useNavLinks();
</script>

<template>
  <footer
    class="mt-16 border-t border-[#c3c6d5] bg-[#f4faff] pt-10 pb-6"
  >
    <div
      class="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 sm:grid-cols-[2fr_1fr_1fr_1fr]"
    >
      <div>
        <div
          class="mb-3 text-[22px] font-black tracking-[-0.04em] text-[#003d92]"
        >
          碼的，上岸了
        </div>
        <p
          class="max-w-90 text-sm leading-relaxed text-[#434653]"
        >
          一個工程師求職市場分析器。爬完台灣各大人力銀行的工程師
          JD，
          算薪水、算技術熱度、算共現組合。看完數據，請去原平台投履歷。
        </p>
      </div>

      <div>
        <div
          class="mb-3 text-[11px] font-bold tracking-[0.15em] text-[#434653]"
        >
          資料來源
        </div>
        <a
          v-for="item in [
            {
              label: '104 人力銀行',
              src: 'https://104.com.tw',
            },
            { label: 'Cake', src: 'https://cake.me' },
          ]"
          :key="item.src"
          :href="item.src"
          target="_blank"
          class="flex items-center gap-1.5 py-1 text-sm font-bold text-[#001f2a]"
        >
          {{ item.label }}
          <span
            class="material-symbols-outlined text-sm text-[#434653]"
            style="font-size: 14px"
          >
            open_in_new
          </span>
        </a>
      </div>

      <div>
        <div
          class="mb-3 text-[11px] font-bold tracking-[0.15em] text-[#434653]"
        >
          產品
        </div>
        <RouterLink
          v-for="item in footerLinks"
          :key="item.label"
          :to="item.to"
          class="block py-1 text-sm font-bold text-[#001f2a] transition-colors hover:text-[#003d92]"
        >
          {{ item.label }}
        </RouterLink>
        <RouterLink
          :to="{ name: 'methodology' }"
          class="block py-1 text-sm font-bold text-[#001f2a] transition-colors hover:text-[#003d92]"
        >
          公開透明
        </RouterLink>
      </div>

      <div>
        <div
          class="mb-3 text-[11px] font-bold tracking-[0.15em] text-[#434653]"
        >
          關於
        </div>
        <div
          v-for="item in [
            '開源於 GitHub',
            '法律聲明',
            '聯絡我們',
          ]"
          :key="item"
          class="py-1 text-sm font-bold text-[#001f2a]"
        >
          {{ item }}
        </div>
      </div>
    </div>

    <div
      class="mx-auto mt-8 flex max-w-7xl items-center justify-between border-t border-dashed border-[#c3c6d5] px-6 pt-4 text-[11px] tracking-wider text-[#434653]"
    >
      <div>© 2026 CodeShore.dev · 「碼」不是錯字。</div>
      <div>{{ version }} · Built in Taipei</div>
    </div>
  </footer>
</template>
