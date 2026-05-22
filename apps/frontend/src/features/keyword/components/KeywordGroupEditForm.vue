<script setup lang="ts">
import { computed, ref } from 'vue';

import { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP, useKeywordStore } from '../useKeywordStore';
import { useKeywordGroupStore } from '../useKeywordGroupStore';

type KeywordGroupView = SupabaseView.KeywordGroupView;

const props = defineProps<{ group: KeywordGroupView }>();
const emit = defineEmits<{ save: []; cancel: [] }>();

const store = useKeywordGroupStore();
const keywordStore = useKeywordStore();
const TAG_OPTIONS = Object.keys(CATEGORY_LABEL_MAP);

const editCategory = ref<string | null>(props.group.category);
const editParent = ref<string | null>(props.group.parent);
const editKeywords = ref<string[]>([...(props.group.keywords ?? [])]);
const keywordInput = ref('');
const editParentSearchInput = ref(props.group.parent ?? '');
const showEditParentDropdown = ref(false);
const groupSearchInput = ref('');
const showGroupDropdown = ref(false);

const editParentSuggestions = computed(() => {
  const q = editParentSearchInput.value.trim().toLowerCase();
  return keywordStore.keywordGroups.filter(
    g => g.keyword_group !== props.group.keyword_group && g.category !== null &&
      (!q || g.keyword_group.toLowerCase().includes(q)),
  );
});

const groupSuggestions = computed(() => {
  const q = groupSearchInput.value.trim().toLowerCase();
  return keywordStore.keywordGroups.filter(
    g => g.keyword_group !== props.group.keyword_group &&
      !editKeywords.value.includes(g.keyword_group) &&
      (!q || g.keyword_group.includes(q)),
  );
});

function pickEditParent(id: string) { editParent.value = id; editParentSearchInput.value = id; showEditParentDropdown.value = false; }
function clearEditParent() { editParent.value = null; editParentSearchInput.value = ''; }
function onEditParentBlur() { setTimeout(() => { showEditParentDropdown.value = false; if (!editParent.value) editParentSearchInput.value = ''; }, 150); }
function addKeyword() { const kw = keywordInput.value.trim().toLowerCase(); if (kw && !editKeywords.value.includes(kw)) editKeywords.value.push(kw); keywordInput.value = ''; }
function removeKeyword(kw: string) { editKeywords.value = editKeywords.value.filter(k => k !== kw); }
function pickGroup(id: string) { if (!editKeywords.value.includes(id)) editKeywords.value.push(id); groupSearchInput.value = ''; showGroupDropdown.value = false; }
function onGroupInputBlur() { setTimeout(() => { showGroupDropdown.value = false; }, 150); }

async function handleSave() {
  await store.updateGroup(props.group.keyword_group, {
    keywords: editKeywords.value,
    category: editCategory.value,
    parent: editParent.value,
  });
  emit('save');
}
function handleCancel() { emit('cancel'); }
</script>

<template>
  <div class="border-t border-[#c3c6d5]/20 px-5 py-4">
    <div class="mb-4">
      <p class="mb-2 text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">分類</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="opt in TAG_OPTIONS" :key="opt"
          class="rounded-full border px-3 py-1 text-sm font-medium transition"
          :class="editCategory === opt ? 'border-[#fd7700] bg-[#fd7700]/15 text-[#fd7700]' : 'border-[#c3c6d5]/40 text-[#434653] hover:border-[#fd7700]/50 dark:text-[#c3c6d5]'"
          @click="editCategory = editCategory === opt ? null : opt">
          {{ CATEGORY_LABEL_MAP[opt] }}
        </button>
      </div>
    </div>

    <div class="mb-4">
      <p class="mb-2 text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">父群組</p>
      <div class="relative max-w-xs">
        <span class="material-symbols-outlined pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-[#434653]/50">account_tree</span>
        <input v-model="editParentSearchInput"
          class="w-full rounded-lg border border-[#c3c6d5]/40 bg-transparent py-1.5 pr-8 pl-10 text-sm focus:border-[#003d92] focus:outline-none dark:text-[#e6f6ff]"
          placeholder="搜尋父群組（選填）…"
          @focus="showEditParentDropdown = true" @blur="onEditParentBlur" @input="editParent = null" />
        <button v-if="editParent"
          class="absolute top-1/2 right-2 -translate-y-1/2 text-[#434653]/50 hover:text-[#434653] dark:text-[#c3c6d5]/50"
          @mousedown.prevent="clearEditParent">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
        <div v-if="showEditParentDropdown && editParentSuggestions.length"
          class="absolute top-full left-0 z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#c3c6d5]/30 bg-white shadow-lg dark:bg-[#001f2a]">
          <button v-for="g in editParentSuggestions" :key="g.keyword_group"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#e6f6ff] dark:hover:bg-[#003d92]/20"
            @mousedown.prevent="pickEditParent(g.keyword_group)">
            <span class="font-mono font-semibold text-[#003d92] dark:text-[#a8d4f5]">{{ g.label }}</span>
            <span class="text-[#434653]/50 dark:text-[#c3c6d5]/50">{{ g.count }} 個職缺</span>
          </button>
        </div>
      </div>
    </div>

    <div class="mb-4">
      <p class="mb-2 text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]">關鍵字</p>
      <div class="flex flex-wrap gap-2">
        <span v-for="kw in editKeywords" :key="kw"
          class="flex items-center gap-1 rounded-full bg-[#e6f6ff] px-2.5 py-0.5 text-sm text-[#003d92] dark:bg-[#003d92]/20 dark:text-[#a8d4f5]">
          {{ kw }}
          <button class="ml-0.5 opacity-60 hover:opacity-100" @click="removeKeyword(kw)">×</button>
        </span>
        <div class="flex items-center gap-1">
          <input v-model="keywordInput"
            class="w-32 rounded-lg border border-[#c3c6d5]/40 bg-transparent px-2 py-1 text-sm focus:border-[#003d92] focus:outline-none dark:text-[#e6f6ff]"
            placeholder="新增關鍵字…" @keydown.enter.prevent="addKeyword" />
          <button class="rounded-lg p-1 text-[#003d92] hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20" @click="addKeyword">
            <span class="material-symbols-outlined text-sm">add</span>
          </button>
        </div>
      </div>
      <div class="relative mt-2">
        <p class="mb-1.5 text-sm text-[#434653]/70 dark:text-[#c3c6d5]/70">從其他群組新增</p>
        <div class="relative max-w-xs">
          <span class="material-symbols-outlined pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-[#434653]/50">search</span>
          <input v-model="groupSearchInput"
            class="w-full rounded-lg border border-[#003d92]/30 bg-transparent py-1 pr-2 pl-7 text-sm focus:border-[#003d92] focus:outline-none dark:border-[#a8d4f5]/30 dark:text-[#e6f6ff]"
            placeholder="搜尋群組名稱…" @focus="showGroupDropdown = true" @blur="onGroupInputBlur" />
          <div v-if="showGroupDropdown"
            class="absolute top-full left-0 z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-[#c3c6d5]/30 bg-white shadow-lg dark:bg-[#001f2a]">
            <button v-for="g in groupSuggestions" :key="g.keyword_group"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#e6f6ff] dark:hover:bg-[#003d92]/20"
              @mousedown.prevent="pickGroup(g.keyword_group)">
              <span class="font-mono font-semibold text-[#003d92] dark:text-[#a8d4f5]">{{ g.label }}</span>
              <span class="text-[#434653]/50 dark:text-[#c3c6d5]/50">{{ g.count }} 個職缺</span>
            </button>
            <div v-if="!groupSuggestions.length" class="px-3 py-2 text-sm text-[#434653]/50 dark:text-[#c3c6d5]/50">無符合的群組</div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button class="flex items-center gap-1.5 rounded-xl bg-[#003d92] px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-[#002a6b] active:scale-95 disabled:opacity-50"
        :disabled="store.saving" @click="handleSave">
        <span v-if="store.saving" class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
        <span v-else class="material-symbols-outlined text-sm">check</span>
        儲存
      </button>
      <button class="rounded-xl px-4 py-2 text-sm font-medium text-[#434653] transition hover:bg-[#e6f6ff] dark:text-[#c3c6d5] dark:hover:bg-[#003d92]/20"
        :disabled="store.saving" @click="handleCancel">取消</button>
    </div>
  </div>
</template>
