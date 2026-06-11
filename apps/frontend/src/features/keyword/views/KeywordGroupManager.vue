<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Pagination from '../../../components/Pagination.vue';
import { useAuthStore } from '../../auth/useAuthStore';
import KeywordGroupBulkToolbar from '../components/KeywordGroupBulkToolbar.vue';
import KeywordGroupCard from '../components/KeywordGroupCard.vue';
import {
  type GroupFilter,
  useKeywordGroupStore,
} from '../useKeywordGroupStore';
import { useKeywordStore } from '../useKeywordStore';

const store = useKeywordGroupStore();
const keywordStore = useKeywordStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

keywordStore.getMvKeywordGroup();
keywordStore.getKeywordGroupCategories();

store.groupsFilter =
  (route.query.filter as GroupFilter) ?? 'all';
store.loadGroups(Number(route.query.page) || 1, true);

watch(
  () => ({
    filter: store.groupsFilter,
    page: store.currentPage,
  }),
  ({ filter, page }) => {
    const query: Record<string, string> = {};
    if (filter !== 'all') query.filter = filter;
    if (page > 1) query.page = String(page);
    router.replace({ query });
  },
);

const showCreateModal = ref(false);
</script>

<template>
  <div class="w-full">
    <div class="mb-8">
      <!-- Eyebrow -->
      <div class="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">● 關鍵字群組管理 · ADMIN</div>
      <div class="flex items-end justify-between gap-4">
        <div>
          <h1 class="text-[2rem] font-black leading-tight tracking-[-0.03em] text-[#001f2a]">
            關鍵字組
          </h1>
          <p class="mt-1 text-sm text-[#434653]">
            管理關鍵字群組、群組內的關鍵字與分類標籤。
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2 pb-1">
          <template v-if="!store.selectMode && authStore.canEdit">
            <button
              class="flex items-center gap-2 rounded-xl border border-[#c3c6d5] bg-white px-4 py-2 text-sm font-bold text-[#434653] shadow-sm transition hover:bg-[#f4faff] active:scale-95"
              @click="store.toggleSelectMode()"
            >
              <span class="material-symbols-outlined text-base">checklist</span>
              選取
            </button>
            <button
              class="flex items-center gap-2 rounded-xl bg-[#003d92] px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-[#1654b9] active:scale-95"
              @click="store.refreshMvKeywordGroup"
            >
              <span class="material-symbols-outlined text-base">refresh</span>
              刷新配對
            </button>
          </template>
          <button
            v-else-if="authStore.canEdit"
            class="flex items-center gap-1.5 rounded-xl border border-[#c3c6d5] bg-white px-4 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#f4faff] active:scale-95"
            @click="store.toggleSelectMode()"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <!-- Filter tabs -->
      <div class="flex w-fit items-center gap-1 rounded-xl border border-[#c3c6d5] bg-white p-1 shadow-sm">
        <button
          v-for="opt in [
            { value: 'all', label: '全部' },
            { value: 'grouped', label: '已入群' },
            { value: 'ungrouped', label: '未入群' },
          ] as const"
          :key="opt.value"
          class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold transition"
          :class="
            store.groupsFilter === opt.value
              ? 'bg-[#003d92] text-white shadow'
              : 'text-[#434653] hover:bg-[#f4faff]'
          "
          @click="store.setGroupsFilter(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Search -->
      <div class="relative flex-1">
        <span class="material-symbols-outlined pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-[#434653]/50">search</span>
        <input
          v-model="store.search"
          type="text"
          placeholder="搜尋群組名稱..."
          class="w-full rounded-xl border border-[#c3c6d5] bg-white py-2 pr-8 pl-8 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:border-[#003d92] focus:outline-none"
        />
        <button
          v-if="store.search"
          class="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-[#434653]/50 hover:text-[#434653]"
          @click="store.search = ''"
        >
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>

    <div v-if="store.loading || store.saving" class="flex flex-col gap-3">
      <div
        v-for="i in 6"
        :key="i"
        class="flex animate-pulse flex-col gap-2 rounded-xl bg-white px-5 py-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
      >
        <div class="flex items-center justify-between">
          <div class="h-4 w-40 rounded bg-[#001f2a]/8" />
          <div class="h-4 w-12 rounded bg-[#001f2a]/8" />
        </div>
        <div class="flex gap-2">
          <div class="h-5 w-16 rounded-full bg-[#001f2a]/8" />
          <div class="h-5 w-12 rounded-full bg-[#001f2a]/8" />
          <div class="h-5 w-20 rounded-full bg-[#001f2a]/8" />
        </div>
      </div>
    </div>

    <template v-else>
      <KeywordGroupBulkToolbar />

      <div class="flex flex-col gap-3">
        <KeywordGroupCard
          v-for="group in store.keywordGroups"
          :key="group.keyword_group"
          :group="group"
        />

        <div
          v-if="!store.totalCount"
          class="flex flex-col items-center justify-center py-20"
        >
          <span class="material-symbols-outlined mb-3 text-5xl text-[#001f2a]/20">label_off</span>
          <p class="font-bold text-[#434653]">尚無關鍵字群組。</p>
          <button
            v-if="authStore.canEdit"
            class="mt-4 cursor-pointer rounded-xl bg-[#003d92] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#1654b9] active:scale-95"
            @click="showCreateModal = true"
          >
            建立第一個群組
          </button>
        </div>
      </div>

      <Pagination
        v-if="store.totalPages > 1"
        :current-page="store.currentPage"
        :total-pages="store.totalPages"
        class="mt-6"
        @update:current-page="store.goToPage($event)"
      />

      <p
        v-if="store.totalCount"
        class="mt-3 text-center text-xs font-bold text-[#434653]/50"
      >
        第 {{ store.currentPage }} 頁，共 {{ store.totalPages }} 頁・總計 {{ store.totalCount }} 個群組
      </p>
    </template>
  </div>
</template>

