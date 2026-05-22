<script setup lang="ts">
import { computed, ref } from 'vue';

import { useKeywordStore } from '../useKeywordStore';
import { useKeywordGroupStore } from '../useKeywordGroupStore';

const props = defineProps<{
  groupId: string;
  keyword: string;
}>();

const emit = defineEmits<{
  done: [];
}>();

const store = useKeywordGroupStore();
const keywordStore = useKeywordStore();

const assignSearchInput = ref('');
const showAssignDropdown = ref(false);
const assigningToId = ref<string | null>(null);

const assigningToLabel = computed(() =>
  keywordStore.keywordGroups.find(g => g.keyword_group === assigningToId.value)?.label ?? assigningToId.value,
);

const assignGroupSuggestions = computed(() => {
  const q = assignSearchInput.value.trim().toLowerCase();
  return keywordStore.keywordGroups.filter(
    g =>
      g.category !== null &&
      g.keyword_group !== props.groupId &&
      (!q || g.keyword_group.includes(q)),
  );
});

async function pickGroupForAssign(targetGroupId: string) {
  assigningToId.value = targetGroupId;
  showAssignDropdown.value = false;
  await store.assignKeywordToGroup(props.keyword, targetGroupId);
  assigningToId.value = null;
  emit('done');
}

function onAssignInputBlur() {
  setTimeout(() => {
    showAssignDropdown.value = false;
  }, 150);
}

function cancel() {
  emit('done');
}
</script>

<template>
  <div class="border-t border-[#c3c6d5]/20 px-5 py-4">
    <div
      v-if="assigningToId"
      class="flex items-center gap-2 text-sm text-[#434653] dark:text-[#c3c6d5]"
    >
      <span
        class="material-symbols-outlined animate-spin text-base text-[#003d92] dark:text-[#a8d4f5]"
        >progress_activity</span
      >
      正在加入
      <span
        class="font-mono font-semibold text-[#003d92] dark:text-[#a8d4f5]"
        >{{ assigningToLabel }}</span
      >
      …
    </div>

    <template v-else>
      <p
        class="mb-2 text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]"
      >
        選擇目標群組
      </p>
      <div class="flex items-center gap-2">
        <div class="relative max-w-xs flex-1">
          <span
            class="material-symbols-outlined pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-[#434653]/50"
            >search</span
          >
          <input
            v-model="assignSearchInput"
            class="w-full rounded-lg border border-[#003d92]/30 bg-transparent py-1 pr-2 pl-7 text-sm focus:border-[#003d92] focus:outline-none dark:border-[#a8d4f5]/30 dark:text-[#e6f6ff]"
            placeholder="搜尋群組名稱…"
            @focus="showAssignDropdown = true"
            @blur="onAssignInputBlur"
          />
          <div
            v-if="showAssignDropdown"
            class="absolute top-full left-0 z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#c3c6d5]/30 bg-white shadow-lg dark:bg-[#001f2a]"
          >
            <button
              v-for="g in assignGroupSuggestions"
              :key="g.keyword_group"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#e6f6ff] dark:hover:bg-[#003d92]/20"
              @mousedown.prevent="pickGroupForAssign(g.keyword_group)"
            >
              <span
                class="font-mono font-semibold text-[#003d92] dark:text-[#a8d4f5]"
                >{{ g.label }}</span
              >
              <span
                class="text-[#434653]/50 dark:text-[#c3c6d5]/50"
                >{{ g.count }} 個職缺</span
              >
            </button>
            <div
              v-if="!assignGroupSuggestions.length"
              class="px-3 py-2 text-sm text-[#434653]/50 dark:text-[#c3c6d5]/50"
            >
              無符合的群組
            </div>
          </div>
        </div>
        <button
          class="rounded-lg px-3 py-1.5 text-sm font-medium text-[#434653] transition hover:bg-[#e6f6ff] dark:text-[#c3c6d5] dark:hover:bg-[#003d92]/20"
          @click="cancel"
        >
          取消
        </button>
      </div>
    </template>
  </div>
</template>
