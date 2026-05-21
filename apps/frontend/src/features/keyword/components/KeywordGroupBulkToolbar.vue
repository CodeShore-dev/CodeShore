<script setup lang="ts">
import { useAuthStore } from '../../auth/useAuthStore';
import { useKeywordGroupStore } from '../useKeywordGroupStore';

const store = useKeywordGroupStore();
const authStore = useAuthStore();

async function handleDeleteSelected(): Promise<void> {
  if (!store.selectedIds.size) return;
  if (
    !confirm(
      `確定要刪除已選取的 ${store.selectedIds.size} 個項目嗎？此操作無法還原。`,
    )
  )
    return;
  const items = store.keywordGroups
    .filter((g) => store.selectedIds.has(g.keyword_group))
    .map((g) => ({
      id: g.keyword_group,
      isKeyword: g.category === null,
    }));
  await store.deleteMultiple(items);
  store.clearSelection();
}

function handleToggleSelectAll(): void {
  if (store.allSelected) {
    store.clearSelection();
  } else {
    store.selectAll();
  }
}
</script>

<template>
  <div
    v-if="authStore.canEdit && store.selectMode"
    class="mb-3 flex items-center justify-between rounded-xl border border-[#c3c6d5]/30 bg-white px-4 py-2.5 shadow-sm dark:bg-[#001f2a]"
  >
    <div class="flex items-center gap-3">
      <button
        class="flex items-center gap-1.5 text-sm font-semibold text-[#434653] transition hover:text-[#003d92] dark:text-[#c3c6d5]"
        @click="handleToggleSelectAll"
      >
        <span
          class="flex size-4 items-center justify-center rounded border-2 transition"
          :class="
            store.allSelected
              ? 'border-[#003d92] bg-[#003d92]'
              : 'border-[#c3c6d5]'
          "
        >
          <span
            v-if="store.allSelected"
            class="material-symbols-outlined text-sm text-white"
            >check</span
          >
        </span>
        {{ store.allSelected ? '取消全選' : '全選本頁' }}
      </button>
      <span
        class="text-sm text-[#434653]/60 dark:text-[#c3c6d5]/60"
      >
        已選 {{ store.selectedIds.size }} /
        {{ store.keywordGroups.length }}
      </span>
    </div>
    <button
      :disabled="!store.selectedIds.size || store.saving"
      class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20"
      @click="handleDeleteSelected"
    >
      <span
        v-if="store.saving"
        class="material-symbols-outlined animate-spin text-base"
        >progress_activity</span
      >
      <span
        v-else
        class="material-symbols-outlined text-base"
        >delete</span
      >
      刪除
      {{
        store.selectedIds.size ? `(${store.selectedIds.size})` : ''
      }}
    </button>
  </div>
</template>
