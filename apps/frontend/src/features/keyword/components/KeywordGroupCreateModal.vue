<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { useKeywordStore } from '../useKeywordStore';
import { useKeywordGroupStore } from '../useKeywordGroupStore';

const props = defineProps<{
  open: boolean;
  sourceKeyword?: string;
}>();

const emit = defineEmits<{ close: [] }>();

const keywordStore = useKeywordStore();
const store = useKeywordGroupStore();

const newGroupId = ref('');
const newGroupCategory = ref<string | null>(null);
const newCategorySearchInput = ref('');
const showNewCategoryDropdown = ref(false);
const newGroupParent = ref<string | null>(null);
const newParentSearchInput = ref('');
const showNewParentDropdown = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    newGroupId.value = props.sourceKeyword ?? '';
    newGroupCategory.value = null;
    newCategorySearchInput.value = '';
    newGroupParent.value = null;
    newParentSearchInput.value = '';
    showNewCategoryDropdown.value = false;
    showNewParentDropdown.value = false;
  },
);

const newCategorySuggestions = computed(() => {
  const q = newCategorySearchInput.value.trim().toLowerCase();
  return keywordStore.categories.filter(
    (c) => !q || c.category.toLowerCase().includes(q),
  );
});

function pickNewCategory(category: string) {
  newGroupCategory.value = category;
  newCategorySearchInput.value = category;
  showNewCategoryDropdown.value = false;
}

function clearNewCategory() {
  newGroupCategory.value = null;
  newCategorySearchInput.value = '';
}

function onNewCategoryBlur() {
  setTimeout(() => { showNewCategoryDropdown.value = false; }, 150);
}

const newParentSuggestions = computed(() => {
  const q = newParentSearchInput.value.trim().toLowerCase();
  return keywordStore.keywordGroups.filter(
    (g) =>
      g.keyword_group !== newGroupId.value.trim().toLowerCase() &&
      g.category !== null &&
      (!q || g.keyword_group.includes(q)),
  );
});

function pickNewParent(groupId: string) {
  newGroupParent.value = groupId;
  newParentSearchInput.value = groupId;
  showNewParentDropdown.value = false;
}

function clearNewParent() {
  newGroupParent.value = null;
  newParentSearchInput.value = '';
}

function onNewParentBlur() {
  setTimeout(() => {
    showNewParentDropdown.value = false;
    if (!newGroupParent.value) newParentSearchInput.value = '';
  }, 150);
}

async function submitCreate() {
  if (!newGroupId.value.trim()) return;
  const id = newGroupId.value.trim().toLowerCase();
  if (props.sourceKeyword) {
    await store.createGroupFromKeyword(
      props.sourceKeyword, id,
      newGroupCategory.value ?? newCategorySearchInput.value,
      newGroupParent.value,
    );
  } else {
    await store.createGroup(id, [], newGroupCategory.value, newGroupParent.value);
  }
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#001f2a]">
        <h2 class="mb-4 text-lg font-bold text-[#003d92] dark:text-[#e6f6ff]">
          新增關鍵字組
        </h2>

        <div
          v-if="sourceKeyword"
          class="mb-4 flex items-center gap-2 rounded-xl bg-[#e6f6ff] px-4 py-2.5 dark:bg-[#003d92]/20"
        >
          <span class="material-symbols-outlined text-base text-[#003d92] dark:text-[#a8d4f5]">label</span>
          <span class="text-sm text-[#003d92] dark:text-[#a8d4f5]">
            關鍵字 <strong>{{ sourceKeyword }}</strong> 將加入此群組並從關鍵字列表移除。
          </span>
        </div>

        <label class="mb-1 block text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">群組名稱</label>
        <input v-model="newGroupId" class="mb-4 w-full rounded-xl border border-[#c3c6d5]/40 bg-transparent px-3 py-2 text-sm focus:border-[#003d92] focus:outline-none dark:text-[#e6f6ff]" placeholder="例如：react、python、postgresql" @keydown.enter.prevent="submitCreate" />

        <label class="mb-2 block text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">分類</label>
        <div class="relative mb-4">
          <span class="material-symbols-outlined pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-[#434653]/50">label</span>
          <input v-model="newCategorySearchInput" class="w-full rounded-xl border border-[#c3c6d5]/40 bg-transparent py-2 pr-8 pl-10 text-sm focus:border-[#003d92] focus:outline-none dark:text-[#e6f6ff]" placeholder="搜尋分類" @focus="showNewCategoryDropdown = true" @blur="onNewCategoryBlur" @input="newGroupCategory = null" />
          <button v-if="newGroupCategory" class="absolute top-1/2 right-2 -translate-y-1/2 text-[#434653]/50 hover:text-[#434653] dark:text-[#c3c6d5]/50" @mousedown.prevent="clearNewCategory">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
          <div v-if="showNewCategoryDropdown" class="absolute top-full left-0 z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#c3c6d5]/30 bg-white shadow-lg dark:bg-[#001f2a]">
            <button v-for="cat in newCategorySuggestions" :key="cat.category" class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#e6f6ff] dark:hover:bg-[#003d92]/20" @mousedown.prevent="pickNewCategory(cat.category)">
              <span class="font-semibold text-[#003d92] dark:text-[#a8d4f5]">{{ cat.category }}</span>
              <span class="text-[#434653]/50 dark:text-[#c3c6d5]/50">{{ cat.count }} 個群組</span>
            </button>
            <div v-if="!newCategorySuggestions.length" class="px-3 py-2 text-sm text-[#434653]/50 dark:text-[#c3c6d5]/50">無符合的分類</div>
          </div>
        </div>

        <label class="mb-2 block text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">父群組</label>
        <div class="relative mb-5">
          <span class="material-symbols-outlined pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-[#434653]/50">account_tree</span>
          <input v-model="newParentSearchInput" class="w-full rounded-xl border border-[#c3c6d5]/40 bg-transparent py-2 pr-8 pl-10 text-sm focus:border-[#003d92] focus:outline-none dark:text-[#e6f6ff]" placeholder="搜尋父群組（選填）…" @focus="showNewParentDropdown = true" @blur="onNewParentBlur" @input="newGroupParent = null" />
          <button v-if="newGroupParent" class="absolute top-1/2 right-2 -translate-y-1/2 text-[#434653]/50 hover:text-[#434653] dark:text-[#c3c6d5]/50" @mousedown.prevent="clearNewParent">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
          <div v-if="showNewParentDropdown && newParentSuggestions.length" class="absolute top-full left-0 z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#c3c6d5]/30 bg-white shadow-lg dark:bg-[#001f2a]">
            <button v-for="g in newParentSuggestions" :key="g.keyword_group" class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#e6f6ff] dark:hover:bg-[#003d92]/20" @mousedown.prevent="pickNewParent(g.keyword_group)">
              <span class="font-mono font-semibold text-[#003d92] dark:text-[#a8d4f5]">{{ g.keyword_group }}</span>
              <span class="text-[#434653]/50 dark:text-[#c3c6d5]/50">{{ g.count }} 個職缺</span>
            </button>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button class="rounded-xl px-4 py-2 text-sm font-medium text-[#434653] transition hover:bg-[#e6f6ff] dark:text-[#c3c6d5] dark:hover:bg-[#003d92]/20" @click="emit('close')">取消</button>
          <button class="flex items-center gap-1.5 rounded-xl bg-[#003d92] px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-[#002a6b] active:scale-95 disabled:opacity-50" :disabled="!newGroupId.trim() || store.saving" @click="submitCreate">
            <span v-if="store.saving" class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            建立
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
