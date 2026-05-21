<script setup lang="ts">
interface SearchInputProps {
  modelValue: string
  placeholder?: string
}

const props = defineProps<SearchInputProps>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function clearValue(): void {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="relative">
    <span
      class="material-symbols-outlined text-on-surface-variant pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base!"
    >search</span>
    <input
      :value="props.modelValue"
      type="text"
      :placeholder="placeholder"
      class="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-xl border py-2.5 pr-8 pl-9 text-sm font-bold focus:outline-none"
      @input="onInput"
    />
    <button
      v-if="props.modelValue"
      class="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-3 flex -translate-y-1/2 cursor-pointer"
      @click="clearValue"
    >
      <span class="material-symbols-outlined text-base">close</span>
    </button>
  </div>
</template>
