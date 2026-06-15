<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
} from 'vue';
import { RouterLink } from 'vue-router';

import { SupabaseView } from '@codeshore/data-types';

import TechIcon from '../../../components/TechIcon.vue';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useAuthStore } from '../../auth/useAuthStore';
import { useKeywordGroupStore } from '../useKeywordGroupStore';

const props = defineProps<{
  group: SupabaseView.MvKeywordGroup;
}>();

const store = useKeywordGroupStore();
const authStore = useAuthStore();

const isEditing = ref(false);
const assigningKeyword = ref<string | null>(null);

const editingIcons = ref(false);
const savingOrder = ref(false);
const anchor = ref({ x: 0, y: 0 });
const popupRef = ref<HTMLElement | null>(null);

const ICON_SOURCES = ['thesvg', 'simple-icons', 'iconify'];
type IconRow = { id: number; source: string; slug: string };
let rowSeq = 0;
const iconRows = ref<IconRow[]>([]);
const availableSources = computed(() => [
  ...new Set([
    ...ICON_SOURCES,
    ...iconRows.value.map(r => r.source),
  ]),
]);

const canEditIcons = computed(
  () => authStore.canEdit && !store.selectMode,
);

function parseEntry(entry: string): IconRow {
  const sep = entry.indexOf(':');
  return {
    id: ++rowSeq,
    source: sep < 0 ? 'iconify' : entry.slice(0, sep),
    slug: sep < 0 ? entry : entry.slice(sep + 1),
  };
}

function previewSlugs(row: IconRow): string[] {
  const slug = row.slug.trim();
  return slug ? [`${row.source}:${slug}`] : [];
}

function openIconEditor(e: MouseEvent) {
  if (!canEditIcons.value) return;
  const r = (
    e.currentTarget as HTMLElement
  ).getBoundingClientRect();
  anchor.value = { x: r.left + r.width / 2, y: r.top };
  iconRows.value = (props.group.icon_slugs ?? []).map(
    parseEntry,
  );
  editingIcons.value = true;
  nextTick(() => {
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKeydown);
  });
}

function closeIconEditor() {
  editingIcons.value = false;
  document.removeEventListener('mousedown', onOutside);
  document.removeEventListener('keydown', onKeydown);
}

function onOutside(e: MouseEvent) {
  if (
    popupRef.value &&
    !popupRef.value.contains(e.target as Node)
  )
    closeIconEditor();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeIconEditor();
}

function moveIcon(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= iconRows.value.length) return;
  const next = [...iconRows.value];
  [next[i], next[j]] = [next[j], next[i]];
  iconRows.value = next;
}

function addIconRow() {
  iconRows.value = [
    ...iconRows.value,
    { id: ++rowSeq, source: 'iconify', slug: '' },
  ];
}

function removeIconRow(i: number) {
  iconRows.value = iconRows.value.filter(
    (_, idx) => idx !== i,
  );
}

async function saveIconOrder() {
  savingOrder.value = true;
  try {
    // 丟掉 slug 空白的列，組回 'source:slug'
    const composed = iconRows.value
      .filter(r => r.slug.trim())
      .map(r => `${r.source}:${r.slug.trim()}`);
    await store.updateIconSlugs(
      props.group.keyword_group,
      composed,
    );
    closeIconEditor();
  } finally {
    savingOrder.value = false;
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onOutside);
  document.removeEventListener('keydown', onKeydown);
});

function handleCardClick() {
  if (store.selectMode) {
    store.toggleSelectId(props.group.keyword_group);
  }
}

async function handleDelete() {
  const isKeyword = props.group.category === null;
  if (
    !confirm(
      `確定要刪除「${props.group.label}」群組嗎？此操作無法還原。`,
    )
  )
    return;
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
    :class="
      store.selectMode &&
      store.selectedIds.has(group.keyword_group)
        ? 'border-[#003d92]/40 bg-[#e6f6ff]/60 dark:bg-[#003d92]/10'
        : ''
    "
    @click="handleCardClick"
  >
    <div
      class="flex items-start justify-between gap-4 px-5 py-4"
      :class="store.selectMode ? 'cursor-pointer' : ''"
    >
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <span
          v-if="store.selectMode"
          class="flex size-4 shrink-0 items-center justify-center rounded border-2 transition"
          :class="
            store.selectedIds.has(group.keyword_group)
              ? 'border-[#003d92] bg-[#003d92]'
              : 'border-[#c3c6d5]'
          "
        >
          <span
            v-if="
              store.selectedIds.has(group.keyword_group)
            "
            class="material-symbols-outlined text-sm text-white"
            >check</span
          >
        </span>

        <button
          v-if="canEditIcons"
          type="button"
          title="點擊調整圖示來源順序"
          class="shrink-0 cursor-pointer rounded-md ring-offset-1 transition hover:ring-2 hover:ring-[#003d92]/40"
          @click.stop="openIconEditor"
        >
          <TechIcon
            :slugs="group.icon_slugs"
            :label="group.label"
            :hide-if-not-found="false"
          />
        </button>
        <TechIcon
          v-else
          :slugs="group.icon_slugs"
          :label="group.label"
          :hide-if-not-found="false"
        />
        <span
          class="flex items-center gap-2 rounded-lg bg-[#e6f6ff] px-3 py-1 font-mono text-sm font-bold text-[#003d92] dark:bg-[#003d92]/30 dark:text-[#a8d4f5]"
        >
          {{ group.label }}
        </span>

        <RouterLink
          :to="{
            path: '/jobs',
            query: { tags: group.keyword_group },
          }"
          class="text-sm text-[#434653] underline-offset-2 hover:underline dark:text-[#c3c6d5]"
          @click.stop
        >
          {{ group.count }} 個職缺
        </RouterLink>

        <span
          v-if="group.category === null"
          class="rounded-full bg-[#434653]/10 px-2 py-0.5 text-sm text-[#434653] dark:bg-white/10 dark:text-[#c3c6d5]"
        >
          關鍵字
        </span>
      </div>

      <div
        v-if="!store.selectMode"
        class="flex shrink-0 items-center gap-2"
      >
        <template
          v-if="
            group.category === null && authStore.canEdit
          "
        >
          <button
            v-if="assigningKeyword !== group.keyword_group"
            class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#003d92] transition hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20"
            @click.stop="
              assigningKeyword = group.keyword_group
            "
          >
            <span
              class="material-symbols-outlined text-base"
              >merge</span
            >
            加入群組
          </button>
        </template>

        <button
          v-else-if="
            group.category !== null &&
            !isEditing &&
            authStore.canEdit
          "
          class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#003d92] transition hover:bg-[#e6f6ff] dark:text-[#a8d4f5] dark:hover:bg-[#003d92]/20"
          @click.stop="isEditing = true"
        >
          <span class="material-symbols-outlined text-base"
            >edit</span
          >
          編輯
        </button>

        <button
          v-if="authStore.canEdit"
          class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-900/20"
          @click.stop="handleDelete"
        >
          <span class="material-symbols-outlined text-base"
            >delete</span
          >
          刪除
        </button>
      </div>
    </div>

    <div class="border-t border-[#c3c6d5]/20 px-5 py-3">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span
          class="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]"
          >分類</span
        >
        <span
          class="rounded-full bg-[#fd7700]/15 px-2 py-0.5 text-sm font-medium text-[#fd7700]"
        >
          {{ CATEGORY_LABEL_MAP[group.category] }}
        </span>
        <template v-if="group.parents">
          <span
            class="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]"
            >父層</span
          >
          <span
            class="rounded-full bg-amber-500/15 px-2 py-0.5 text-sm font-medium text-amber-500"
          >
            {{ group.parents }}
          </span>
        </template>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="text-sm font-semibold text-[#434653] dark:text-[#c3c6d5]"
          >關鍵字</span
        >
        <span
          v-for="kw in group.keywords"
          :key="kw"
          class="rounded-full bg-[#e6f6ff] px-2 py-0.5 text-sm text-[#003d92] dark:bg-[#003d92]/20 dark:text-[#a8d4f5]"
        >
          {{ kw }}
        </span>
        <span
          v-if="!group.keywords?.length"
          class="text-sm text-[#434653]/50 italic dark:text-[#c3c6d5]/50"
          >—</span
        >
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="editingIcons"
      ref="popupRef"
      class="fixed z-50 w-92 -translate-x-1/2 -translate-y-full rounded-xl border border-[#c3c6d5]/40 bg-white p-3 shadow-[0_12px_40px_rgba(0,31,42,0.18)]"
      :style="{
        left: `${anchor.x}px`,
        top: `${anchor.y - 10}px`,
      }"
      @click.stop
    >
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-bold text-[#001f2a]"
          >圖示來源</span
        >
        <span class="text-[10px] text-[#434653]/60"
          >上＝優先</span
        >
      </div>

      <div
        class="flex max-h-64 flex-col gap-1.5 overflow-auto"
      >
        <div
          v-for="(row, i) in iconRows"
          :key="row.id"
          class="flex items-center gap-1.5 rounded-lg border border-[#eef3f8] bg-[#f7fbff] px-1.5 py-1.5"
        >
          <TechIcon
            :slugs="previewSlugs(row)"
            :label="group.label"
            :hide-if-not-found="false"
          />
          <select
            v-model="row.source"
            class="min-w-16 shrink-0 rounded border border-[#c3c6d5]/60 bg-white py-1 pr-0.5 pl-1 text-[11px] text-[#001f2a] focus:border-[#003d92] focus:outline-none"
          >
            <option
              v-for="s in availableSources"
              :key="s"
              :value="s"
            >
              {{ s }}
            </option>
          </select>
          <input
            v-model="row.slug"
            type="text"
            placeholder="slug"
            class="min-w-0 flex-1 rounded border border-[#c3c6d5]/60 bg-white px-1.5 py-1 text-[11px] text-[#001f2a] focus:border-[#003d92] focus:outline-none"
          />
          <div class="flex shrink-0 flex-col">
            <button
              type="button"
              class="flex h-3.5 w-5 cursor-pointer items-center justify-center text-[#003d92] disabled:cursor-default disabled:opacity-25"
              :disabled="i === 0"
              @click="moveIcon(i, -1)"
            >
              <span
                class="material-symbols-outlined text-base leading-none"
                >arrow_drop_up</span
              >
            </button>
            <button
              type="button"
              class="flex h-3.5 w-5 cursor-pointer items-center justify-center text-[#003d92] disabled:cursor-default disabled:opacity-25"
              :disabled="i === iconRows.length - 1"
              @click="moveIcon(i, 1)"
            >
              <span
                class="material-symbols-outlined text-base leading-none"
                >arrow_drop_down</span
              >
            </button>
          </div>
          <button
            type="button"
            title="刪除此來源"
            class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-red-500 transition hover:bg-red-50"
            @click="removeIconRow(i)"
          >
            <span
              class="material-symbols-outlined text-base"
              >close</span
            >
          </button>
        </div>

        <p
          v-if="!iconRows.length"
          class="px-1 py-2 text-center text-[11px] text-[#434653]/60"
        >
          尚無圖示來源，按下方「新增來源」。
        </p>
      </div>

      <button
        type="button"
        class="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-[#c3c6d5] py-1.5 text-[11px] font-bold text-[#003d92] transition hover:bg-[#f4faff]"
        @click="addIconRow"
      >
        <span class="material-symbols-outlined text-sm"
          >add</span
        >
        新增來源
      </button>

      <div class="mt-3 flex justify-end gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-[#434653] transition hover:bg-[#f4faff]"
          @click="closeIconEditor"
        >
          取消
        </button>
        <button
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg bg-[#003d92] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1654b9] disabled:opacity-50"
          :disabled="savingOrder"
          @click="saveIconOrder"
        >
          <span
            v-if="savingOrder"
            class="material-symbols-outlined animate-spin text-sm"
            >progress_activity</span
          >
          儲存
        </button>
      </div>
    </div>
  </Teleport>
</template>
