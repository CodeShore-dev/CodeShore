<script lang="ts" setup>
import { useJobStore } from '../useJobStore';

const store = useJobStore();
</script>

<template>
  <div class="divide-y divide-[#001f2a]/[0.06]">
    <div
      v-for="i in store.listPageSize"
      :key="i"
      class="flex animate-pulse flex-col gap-2 p-4"
    >
      <div class="flex items-center gap-2">
        <div class="bg-[#001f2a]/[0.08] h-4 w-1/2 rounded" />
        <div class="bg-[#001f2a]/[0.08] ml-auto h-3 w-3 rounded" />
      </div>
      <div class="flex gap-3">
        <div class="bg-[#001f2a]/[0.08] h-3 w-24 rounded" />
        <div class="bg-[#001f2a]/[0.08] h-3 w-20 rounded" />
      </div>
      <div class="flex gap-3">
        <div class="bg-[#001f2a]/[0.08] h-3 w-24 rounded" />
        <div class="bg-[#001f2a]/[0.08] ml-auto h-3 w-16 rounded" />
      </div>
    </div>
  </div>
</template>
