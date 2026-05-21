<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Pagination from '../../../components/Pagination.vue';
import { useAuthStore } from '../../auth/useAuthStore';
import KeywordGroupBulkToolbar from '../components/KeywordGroupBulkToolbar.vue';
import KeywordGroupCard from '../components/KeywordGroupCard.vue';
import KeywordGroupCreateModal from '../components/KeywordGroupCreateModal.vue';
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

keywordStore.getKeywordGroupView();
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
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1
          class="text-2xl font-bold tracking-tight text-[#003d92] dark:text-[#e6f6ff]"
        >
          關鍵字組
        </h1>
        <p
          class="mt-1 text-sm text-[#434653] dark:text-[#c3c6d5]"
        >
          管理關鍵字群組、群組內的關鍵字與分類標籤。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <template
          v-if="!store.selectMode && authStore.canEdit"
        >
          <button
            class="flex items-center gap-2 rounded-xl border border-[#c3c6d5]/50 px-4 py-2 text-sm font-semibold text-[#434653] shadow-sm transition hover:bg-[#e6f6ff] active:scale-95 dark:border-[#c3c6d5]/20 dark:text-[#c3c6d5] dark:hover:bg-[#003d92]/20"
            @click="store.toggleSelectMode()"
          >
            <span
              class="material-symbols-outlined text-base"
              >checklist</span
            >
            選取
          </button>
          <button
            class="flex items-center gap-2 rounded-xl bg-[#003d92] px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-[#002a6b] active:scale-95"
            @click="store.refreshMvKeywordGroup"
          >
            <span
              class="material-symbols-outlined text-base"
              >refresh</span
            >
            刷新關鍵字組配對
          </button>
        </template>
        <button
          v-else-if="authStore.canEdit"
          class="flex items-center gap-1.5 rounded-xl border border-[#c3c6d5]/50 px-4 py-2 text-sm font-semibold text-[#434653] transition hover:bg-[#e6f6ff] dark:text-[#c3c6d5]"
          @click="store.toggleSelectMode()"
        >
          取消
        </button>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div
        class="flex w-fit items-center gap-1 rounded-xl border border-[#c3c6d5]/30 bg-white p-1 dark:bg-[#001f2a]"
      >
        <button
          v-for="opt in [
            { value: 'all', label: '全部' },
            { value: 'grouped', label: '已入群' },
            { value: 'ungrouped', label: '未入群' },
          ] as const"
          :key="opt.value"
          class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition"
          :class="
            store.groupsFilter === opt.value
              ? 'bg-[#003d92] text-white shadow'
              : 'text-[#434653] hover:bg-[#e6f6ff] dark:text-[#c3c6d5] dark:hover:bg-[#003d92]/20'
          "
          @click="store.setGroupsFilter(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="relative flex-1">
        <span
          class="material-symbols-outlined pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-[#434653]/50 dark:text-[#c3c6d5]/50"
          >search</span
        >
        <input
          v-model="store.search"
          type="text"
          placeholder="搜尋群組名稱..."
          class="w-full rounded-xl border border-[#c3c6d5]/30 bg-white py-2 pr-8 pl-8 text-sm font-medium focus:border-[#003d92] focus:outline-none dark:bg-[#001f2a] dark:text-[#e6f6ff]"
        />
        <button
          v-if="store.search"
          class="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#434653]/50 hover:text-[#434653] dark:text-[#c3c6d5]/50"
          @click="store.search = ''"
        >
          <span class="material-symbols-outlined text-base"
            >close</span
          >
        </button>
      </div>
    </div>

    <div
      v-if="store.loading"
      class="flex items-center justify-center py-20 text-[#434653] dark:text-[#c3c6d5]"
    >
      <span
        class="material-symbols-outlined animate-spin text-3xl"
        >progress_activity</span
      >
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
          class="flex flex-col items-center justify-center py-20 text-[#434653] dark:text-[#c3c6d5]"
        >
          <span
            class="material-symbols-outlined mb-3 text-5xl"
            >label_off</span
          >
          <p class="font-medium">尚無關鍵字群組。</p>
          <button
            v-if="authStore.canEdit"
            class="mt-4 rounded-xl bg-[#003d92] px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-[#002a6b]"
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
        class="mt-3 text-center text-sm text-[#434653]/60 dark:text-[#c3c6d5]/60"
      >
        第 {{ store.currentPage }} 頁，共
        {{ store.totalPages }} 頁・總計
        {{ store.totalCount }} 個群組
      </p>
    </template>

    <KeywordGroupCreateModal
      :open="showCreateModal"
      @close="showCreateModal = false"
    />
  </div>
</template>

