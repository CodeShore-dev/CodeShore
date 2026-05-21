<script setup lang="ts">
type Operator = 'and' | 'or'

interface OperatorToggleProps {
  modelValue: Operator
}

const props = defineProps<OperatorToggleProps>()

const emit = defineEmits<{
  'update:modelValue': [value: Operator]
}>()

const options: { value: Operator; label: string }[] = [
  { value: 'and', label: 'AND' },
  { value: 'or', label: 'OR' },
]

function select(value: Operator): void {
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}
</script>

<template>
  <div class="border-surface-container-highest flex overflow-hidden rounded border">
    <button
      v-for="op in options"
      :key="op.value"
      class="flex-1 cursor-pointer px-2 py-0.5 text-sm font-bold transition-colors"
      :class="
        props.modelValue === op.value
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
      "
      @click="select(op.value)"
    >{{ op.label }}</button>
  </div>
</template>
