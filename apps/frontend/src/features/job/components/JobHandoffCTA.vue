<script setup lang="ts">
defineProps<{ detailLink: string | undefined }>();
</script>

<template>
  <div class="mb-6 grid grid-cols-[1fr_auto] items-center gap-5 rounded-2xl border-2 border-[#003d92] p-5">
    <div>
      <div class="mb-1 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">準備好投履歷？</div>
      <div class="text-[15px] font-bold leading-snug text-[#001f2a]">
        我們不收履歷。請去 <strong class="text-[#003d92]">原始職缺頁</strong> 投。
      </div>
      <div class="mt-1 text-xs text-[#434653]">資料來源 · {{ detailLink }}</div>
    </div>
    <a
      :href="detailLink"
      target="_blank"
      rel="noreferrer"
      class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-[#003d92] px-5 py-3.5 text-sm font-black text-white no-underline transition-colors hover:bg-[#1654b9] active:scale-95"
    >
      前往原始職缺
      <span class="material-symbols-outlined" style="font-size:16px">open_in_new</span>
    </a>
  </div>
</template>
