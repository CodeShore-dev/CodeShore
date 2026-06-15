<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, reactive, watch } from 'vue';

import Pagination from '../../../components/Pagination.vue';
import { AnomalyJob } from '../service';

type Props = {
  title: string;
  icon: string;
  count: number;
  loading: boolean;
  items: AnomalyJob[];
  page: number;
  pageSize: number;
  valueColumn: 'salary' | 'location' | 'none';
  valueLabel?: string;
  crawlRunning: boolean;
  editableSalary?: boolean;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:page': [page: number];
  'recrawl-row': [id: string];
  'recrawl-bulk': [];
  'save-salary': [
    payload: {
      id: string;
      min: number;
      max: number;
      type: 'month' | 'year';
    },
  ];
}>();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.count / props.pageSize)),
);

const fmt = (d: string) =>
  d ? dayjs(d).format('YYYY-MM-DD') : '—';

const draft = reactive<
  Record<
    string,
    { min: number; max: number; type: 'month' | 'year' }
  >
>({});
watch(
  () => props.items,
  items => {
    if (!props.editableSalary) return;
    for (const k of Object.keys(draft)) delete draft[k];
    for (const j of items)
      draft[j.id] = {
        min: j.min_salary ?? 0,
        max: j.max_salary ?? 0,
        type: j.salary_type === 'year' ? 'year' : 'month',
      };
  },
  { immediate: true },
);

const saveSalary = (job: AnomalyJob) => {
  const d = draft[job.id];
  if (!d) return;
  emit('save-salary', {
    id: job.id,
    min: d.min,
    max: d.max,
    type: d.type,
  });
};
</script>

<template>
  <section
    class="border-surface-container bg-surface-container-lowest overflow-hidden rounded-2xl border"
  >
    <header
      class="bg-surface-container flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3"
    >
      <div class="flex items-center gap-2">
        <span
          class="material-symbols-outlined text-primary"
          >{{ icon }}</span
        >
        <h3 class="text-on-surface font-bold mb-0">
          {{ title }}
        </h3>
        <span
          class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-bold"
          >{{ count }}</span
        >
      </div>
      <div class="flex items-center gap-2">
        <slot name="controls" />
        <button
          class="bg-primary text-on-primary hover:bg-primary/90 flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="crawlRunning || count === 0"
          @click="emit('recrawl-bulk')"
        >
          <span class="material-symbols-outlined text-sm"
            >bug_report</span
          >
          整批重抓
        </button>
      </div>
    </header>

    <div class="relative overflow-x-auto">
      <div
        v-if="loading"
        class="text-on-surface-variant px-3 sm:px-5 py-8 text-center text-sm"
      >
        載入中…
      </div>
      <div
        v-else-if="items.length === 0"
        class="text-on-surface-variant px-3 sm:px-5 py-8 text-center text-sm"
      >
        沒有資料 🎉
      </div>
      <table
        v-else
        class="w-full border-collapse text-left text-sm"
      >
        <thead>
          <tr
            class="text-on-surface-variant border-surface-container border-b text-xs"
          >
            <th class="px-3 sm:px-5 py-2 font-semibold">職缺標題</th>
            <th
              v-if="valueColumn !== 'none'"
              class="px-3 sm:px-5 py-2 font-semibold"
            >
              {{ valueLabel }}
            </th>
            <th class="px-3 sm:px-5 py-2 font-semibold">更新時間</th>
            <th class="px-3 sm:px-5 py-2 text-right font-semibold">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="job in items"
            :key="job.id"
            class="border-surface-container/60 hover:bg-surface-container/40 border-b transition"
          >
            <td class="max-w-xs px-3 sm:px-5 py-2">
              <a
                :href="job.detail_link"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary line-clamp-1 font-medium hover:underline"
                >{{ job.title || '(無標題)' }}</a
              >
            </td>
            <td
              v-if="valueColumn !== 'none'"
              class="text-on-surface-variant px-3 sm:px-5 py-2"
            >
              <template v-if="editableSalary">
                <div class="flex flex-col gap-1">
                  <span
                    class="text-on-surface-variant/80 line-clamp-1 text-xs"
                  >
                    {{ job.salary || '—' }}
                    <span
                      v-if="job.salary_manual"
                      class="bg-primary/10 text-primary ml-1 rounded px-1 py-0.5 text-[10px] font-bold"
                      >人工</span
                    >
                  </span>
                  <div
                    v-if="draft[job.id]"
                    class="flex items-center gap-1"
                  >
                    <select
                      v-model="draft[job.id].type"
                      class="border-surface-container bg-surface-container text-on-surface rounded border py-1 pr-8 pl-2 text-sm"
                    >
                      <option value="month">月</option>
                      <option value="year">年</option>
                    </select>
                    <input
                      v-model.number="draft[job.id].min"
                      type="number"
                      class="border-surface-container bg-surface-container text-on-surface w-24 rounded border px-2 py-1 text-sm"
                    />
                    <span class="text-xs">~</span>
                    <input
                      v-model.number="draft[job.id].max"
                      type="number"
                      class="border-surface-container bg-surface-container text-on-surface w-24 rounded border px-2 py-1 text-sm"
                    />
                    <button
                      class="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="loading"
                      @click="saveSalary(job)"
                    >
                      儲存
                    </button>
                  </div>
                </div>
              </template>
              <span v-else class="line-clamp-1">{{
                (valueColumn === 'salary'
                  ? job.salary
                  : job.location) || '—'
              }}</span>
            </td>
            <td
              class="text-on-surface-variant px-3 sm:px-5 py-2 whitespace-nowrap"
            >
              {{ fmt(job.updated_at) }}
            </td>
            <td class="px-3 sm:px-5 py-2 text-right">
              <button
                class="text-primary hover:bg-primary-container inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="crawlRunning"
                @click="emit('recrawl-row', job.id)"
              >
                <span class="material-symbols-outlined text-sm"
                  >bug_report</span
                >
                重抓
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="px-3 sm:px-5 pb-4">
      <Pagination
        :current-page="page"
        :total-pages="totalPages"
        @update:current-page="emit('update:page', $event)"
      />
    </div>
  </section>
</template>
