<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

import { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useKeywordGroupStore } from '../useKeywordGroupStore';
import { useAuthStore } from '../../auth/useAuthStore';

const props = defineProps<{ group: SupabaseView.MvKeywordGroup }>();

const store = useKeywordGroupStore();
const authStore = useAuthStore();

const isEditing = ref(false);
const assigningKeyword = ref<string | null>(null);

function handleCardClick() {
  if (store.selectMode) {
    store.toggleSelectId(props.group.keyword_group);
  }
}

async function handleDelete() {
  const isKeyword = props.group.category === null;
  if (!confirm(`確定要刪除「${props.group.label}」群組嗎？此操作無法還原。`)) return;
  if (isKeyword) {
    await store.removeKeyword(props.group.keyword_group);
  } else {
    await store.deleteGroup(props.group.keyword_group);
  }
}
</script>

<template>
  <div
    class="rounded-2xl border border-[#c3c6d5]/30 bg-white shadow-sm transition dark:bg-[#001f2a]"
    :class="store.selectMode && store.selectedIds.has(group.keyword_group)
      ? 'border-[#003d92]/40 bg-[#e6f6ff]/60 dark:bg-[#003d92]/10'
      : ''"
    @click="handleCardClick"
  >
    <!-- Header row -->
    <div
      class="flex items-start justify-between gap-4 px-5 py-4"
      :class="store.selectMode ? 'cursor-pointer' : ''"
    >
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <!-- Checkbox (selectMode) -->
        <span
          v-if="store.selectMode"
          class="flex size-4 shrink-0 items-center justify-center rounded border-2 transition"
          :class="store.selectedIds.has(group.keyword_group)
            ? 'border-[#003d92] bg-[#003d92]'
            : 'border-[#c3c6d5]'"
        >
          <span
            v-if="store.selectedIds.has(group.keyword_group)"
            class="material-symbols-outlined text-sm text-white"
            >check</span
          >
        </span>

        <!-- Group name badge -->
        <span
          class="rounded-lg bg-[#e6f6ff] px-3 py-1 font-mono text-sm font-bold text-[#003d92] dark:bg-[#003d92]/30 dark:text-[#a8d4f5]"
        >
          {{ group.label }}
        </span>

        <!-- Job count link -->
        <RouterLink
          :to="{ path: '/jobs', query: { tags: group.keyword_group } }"
          class="text-sm text-[#434653] underline-offset-2 hover:underline dark:text-[#c3c6d5]"
          @click.stop
        >
          {{ group.count }} 個職缺
        </RouterLink>

        <!-- Keyword badge (ungrouped items) -->
        <span
          v-if="group.category === null"
          class="rounded-full bg-[#434653]/10 px-2 py-0.5 text-sm text-[#434653] dark:bg-white/10 dark:text-[#c3c6d5]"
        >
          關鍵字
        </span>
      </div>

      <!-- Action buttons (non-selectMode) -->
      <div v-if="!store.selectMode" class="flex shrink-0 items-center gap-2">
        <template v-if="group.category === null && authStore.canEdit">
          <button
            v-if="assigningKeyword !== group.keyword_group"
            class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#003d92] transition hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20"
            @click.stop="assigningKeyword = group.keyword_group"
          >
            <span class="material-symbols-outlined text-base">merge</span>
            加入群組
          </button>
        </template>

        <button
          v-else-if="group.category !== null && !isEditing && authStore.canEdit"
          class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#003d92] transition hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20"
          @click.stop="isEditing = true"
        >
          <span class="material-symbols-outlined text-base">edit</span>
          編輯
        </button>

        <button
          v-if="authStore.canEdit"
          class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20"
          @click.stop="handleDelete"
        >
          <span class="material-symbols-outlined text-base">delete</span>
          刪除
        </button>
      </div>
    </div>

    <!-- Group info (non-edit, grouped items) -->
    <div
      class="border-t border-[#c3c6d5]/20 px-5 py-3"
    >
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">分類</span>
        <span class="rounded-full bg-[#fd7700]/15 px-2 py-0.5 text-sm font-medium text-[#fd7700]">
          {{ CATEGORY_LABEL_MAP[group.category] }}
        </span>
        <template v-if="group.parents">
          <span class="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">父層</span>
          <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-sm font-medium text-amber-500">
            {{ group.parents }}
          </span>
        </template>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">關鍵字</span>
        <span
          v-for="kw in group.keywords"
          :key="kw"
          class="rounded-full bg-[#e6f6ff] px-2 py-0.5 text-sm text-[#003d92] dark:bg-[#003d92]/20 dark:text-[#a8d4f5]"
        >
          {{ kw }}
        </span>
        <span
          v-if="!group.keywords?.length"
          class="text-sm italic text-[#434653]/50 dark:text-[#c3c6d5]/50"
          >—</span
        >
      </div>
    </div>
  </div>
</template>
