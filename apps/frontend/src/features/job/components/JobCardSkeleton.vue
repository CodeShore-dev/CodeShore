<template>
  <div class="flex grow animate-pulse flex-col p-8">
    <div class="mb-6">
      <div class="mb-5 h-8 w-3/4 rounded bg-[#001f2a]/[0.08]" />
      <div class="flex flex-wrap gap-3">
        <div class="h-5 w-24 rounded bg-[#001f2a]/[0.08]" />
        <div class="h-5 w-32 rounded bg-[#001f2a]/[0.08]" />
        <div class="ml-auto flex gap-3">
          <div class="h-5 w-28 rounded bg-[#001f2a]/[0.08]" />
        </div>
      </div>
    </div>
    <div class="space-y-3 py-1">
      <div
        v-for="(w, i) in ['w-full', 'w-5/6', 'w-full', 'w-4/6']"
        :key="i"
        class="h-4 rounded bg-[#001f2a]/[0.08]"
        :class="w"
      />
    </div>
    <div class="mt-8 flex flex-wrap gap-2">
      <div
        v-for="(w, i) in ['w-16', 'w-20', 'w-24', 'w-14']"
        :key="i"
        class="h-6 rounded-full bg-[#001f2a]/[0.08]"
        :class="w"
      />
    </div>
  </div>
</template>
