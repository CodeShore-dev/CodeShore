<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useKeywordStore } from '../../keyword/useKeywordStore';
import { useJobStore } from '../useJobStore';

type Props = {
  keyword: string;
  x: number;
  y: number;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const keywordStore = useKeywordStore();
const jobStore = useJobStore();

const groupSearch = ref('');
const showSuggestions = ref(false);
const newGroupCategory = ref<string | null>(null);
const saving = ref(false);

watch(
  () => props.keyword,
  value => {
    groupSearch.value = value.toLocaleLowerCase();
    showSuggestions.value = false;
    newGroupCategory.value = null;
  },
  {
    immediate: true,
  },
);

const groupSuggestions = computed(() => {
  const q = groupSearch.value.toLowerCase();
  return keywordStore.keywordGroups
    .filter(g => g.keyword_group.toLowerCase().includes(q))
    .slice(0, 8);
});

const isNewGroup = computed(() => {
  const q = groupSearch.value.trim().toLowerCase();
  if (!q) return false;
  return !keywordStore.keywordGroups.some(
    g => g.keyword_group.toLowerCase() === q,
  );
});

const availableTags = computed(() =>
  keywordStore.tabs
    .filter(t => t.value !== '')
    .map(t => ({ label: t.label, value: t.value })),
);

const selectGroup = (groupName: string) => {
  groupSearch.value = groupName;
  showSuggestions.value = false;
  newGroupCategory.value = null;
};

const closePopover = () => {
  groupSearch.value = '';
  showSuggestions.value = false;
  newGroupCategory.value = null;
  emit('close');
};

const confirmSave = async () => {
  if (!props.keyword || !groupSearch.value.trim()) return;
  saving.value = true;
  try {
    await keywordStore.saveKeywordToGroup(
      groupSearch.value.trim(),
      props.keyword,
      isNewGroup.value
        ? newGroupCategory.value || 'Others'
        : undefined,
    );
    await jobStore.fetchListJobs({
      preference: jobStore.listViewPreference,
      page: jobStore.listPage,
    });
    closePopover();
  } finally {
    saving.value = false;
  }
};

const blur = () => {
  setTimeout(() => (showSuggestions.value = false), 150);
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="keyword"
      class="fixed inset-0 z-50"
      @mousedown.self="closePopover"
    >
      <div
        class="bg-surface-container-lowest absolute min-w-64 rounded-xl p-4 shadow-2xl"
        :style="{
          left: `${x}px`,
          top: `${y - 8}px`,
          transform: 'translate(-50%, -100%)',
        }"
        @mousedown.stop
      >
        <div class="mb-3">
          <span
            class="text-on-surface-variant mb-1 block text-sm font-bold tracking-widest "
            >選取的關鍵字</span
          >
          <span
            class="bg-primary text-on-primary rounded-full px-3 py-1 text-sm font-bold "
            >{{ keyword }}</span
          >
        </div>

        <div class="relative mb-3">
          <span
            class="text-on-surface-variant mb-1 block text-sm font-bold tracking-widest "
            >加入關鍵字組</span
          >
          <input
            v-model="groupSearch"
            type="text"
            placeholder="搜尋或輸入群組名稱..."
            class="border-surface-container-highest text-on-surface placeholder-on-surface-variant/50 bg-surface-container w-full rounded-lg border px-3 py-2 text-sm font-bold focus:outline-none"
            @focus="showSuggestions = true"
            @blur="blur"
          />
          <ul
            v-if="
              showSuggestions && groupSuggestions.length
            "
            class="bg-surface-container-lowest border-surface-container absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
          >
            <li
              v-for="g in groupSuggestions"
              :key="g.keyword_group"
              class="hover:bg-surface-container cursor-pointer px-3 py-2 text-sm font-bold transition-colors"
              @mousedown.prevent="
                selectGroup(g.keyword_group)
              "
            >
              {{ g.keyword_group }}
            </li>
          </ul>
        </div>

        <div v-if="isNewGroup" class="mb-3">
          <span
            class="text-on-surface-variant mb-1 block text-sm font-bold tracking-widest "
            >分類</span
          >
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in availableTags"
              :key="tag.value"
              class="rounded-full px-3 py-1 text-sm font-bold  transition-colors"
              :class="
                newGroupCategory === tag.value
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-primary-container hover:text-on-primary'
              "
              @mousedown.prevent="
                newGroupCategory =
                  newGroupCategory === tag.value
                    ? null
                    : tag.value
              "
            >
              {{ tag.label }}
            </button>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button
            class="text-on-surface-variant hover:bg-surface-container cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
            @click="closePopover"
          >
            取消
          </button>
          <button
            :disabled="!groupSearch.trim() || saving"
            class="bg-primary text-on-primary cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            @click="confirmSave"
          >
            {{ saving ? '儲存中...' : '儲存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

