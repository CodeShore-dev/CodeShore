<script setup lang="ts">
defineProps<{
  mapping: { key: string; label?: string; value: string[] }[];
  selectedKeywordsSet: Set<string>;
}>();
</script>

<template>
  <div
    v-if="mapping.length"
    class="mb-5 rounded-xl bg-[#e6f6ff] p-4"
  >
    <div class="mb-2 text-[11px] font-bold tracking-[0.12em] text-[#434653]">
      此 JD 命中的關鍵字
    </div>
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="m in mapping"
        :key="m.key"
        class="rounded-md px-2 py-0.5 text-xs font-bold"
        :class="
          selectedKeywordsSet.size && m.value.some(v => selectedKeywordsSet.has(v.toLowerCase()))
            ? 'bg-[#003d92] text-white'
            : 'bg-[#003d92]/15 text-[#003d92]'
        "
      >{{ m.label ?? m.key }}</span>
    </div>
  </div>
</template>
