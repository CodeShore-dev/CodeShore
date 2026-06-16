<script setup lang="ts">
import { scrollToTop } from '../utils/scroll'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

const props = defineProps<PaginationProps>()

const emit = defineEmits<{
  'update:currentPage': [page: number]
}>()

function goToPage(page: number): void {
  if (page < 1 || page > props.totalPages) return
  emit('update:currentPage', page)
  scrollToTop()
}

function prevPage(): void {
  if (props.currentPage > 1) {
    emit('update:currentPage', props.currentPage - 1)
    scrollToTop()
  }
}

function nextPage(): void {
  if (props.currentPage < props.totalPages) {
    emit('update:currentPage', props.currentPage + 1)
    scrollToTop()
  }
}

function showPage(page: number): boolean {
  return (
    page === 1 ||
    page === props.totalPages ||
    Math.abs(page - props.currentPage) <= 1
  )
}

function showEllipsis(page: number): boolean {
  return (
    page === props.currentPage - 2 ||
    page === props.currentPage + 2
  )
}
</script>

<template>
  <div v-if="totalPages > 1" class="mt-8 flex items-center justify-center gap-2">
    <button
      class="bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:text-outline-variant flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
      :disabled="currentPage === 1"
      @click="prevPage()"
    >
      <span class="material-symbols-outlined text-base">chevron_left</span>
    </button>

    <template v-for="page in totalPages" :key="page">
      <button
        v-if="showPage(page)"
        class="flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-bold transition-colors"
        :class="page === currentPage
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
        @click="goToPage(page)"
      >{{ page }}</button>
      <span
        v-else-if="showEllipsis(page)"
        class="text-on-surface-variant px-1 text-sm"
      >…</span>
    </template>

    <button
      class="bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:text-outline-variant flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
      :disabled="currentPage === totalPages"
      @click="nextPage()"
    >
      <span class="material-symbols-outlined text-base">chevron_right</span>
    </button>
  </div>
</template>
