<script setup lang="ts">
import dayjs from 'dayjs';
import {
  computed,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { formatNumber } from '../../../utils/format';
import AnomalyTable from '../components/AnomalyTable.vue';
import LocationGroupTable from '../components/LocationGroupTable.vue';
import { useAdminStore } from '../useAdminStore';

const store = useAdminStore();

const statsDays = ref(store.statsDays);

type Condition = {
  column: string;
  operator: string;
  value: string;
};

const conditionColumns = [
  { value: 'updated_at', label: '更新時間 updated_at' },
  { value: 'created_at', label: '建立時間 created_at' },
  { value: 'salary_type', label: '薪資類型 salary_type' },
  { value: 'min_salary', label: '最低薪資 min_salary' },
  { value: 'max_salary', label: '最高薪資 max_salary' },
  { value: 'location', label: '地點 location' },
  { value: 'title', label: '標題 title' },
  { value: 'description', label: '描述 description' },
  { value: 'company_id', label: '公司 company_id' },
  { value: 'closed', label: '已關閉 closed' },
  { value: 'salary', label: '薪資字串 salary' },
  { value: 'id', label: '職缺 id' },
];

const conditionOperators = [
  { value: 'eq', label: '= eq' },
  { value: 'neq', label: '≠ neq' },
  { value: 'gt', label: '> gt' },
  { value: 'gte', label: '≥ gte' },
  { value: 'lt', label: '< lt' },
  { value: 'lte', label: '≤ lte' },
  { value: 'ilike', label: '模糊 ilike' },
  { value: 'like', label: '模糊 like' },
  { value: 'is', label: 'is (null)' },
  { value: 'in', label: 'in (a,b)' },
];

const conditions = reactive<Condition[]>([
  { column: 'updated_at', operator: 'lt', value: '' },
]);

const addCondition = () =>
  conditions.push({
    column: 'updated_at',
    operator: 'lt',
    value: '',
  });

const removeCondition = (i: number) => {
  conditions.splice(i, 1);
  if (conditions.length === 0) addCondition();
};

const staleDays = ref(30);
const addStaleCondition = () =>
  conditions.push({
    column: 'updated_at',
    operator: 'lt',
    value: dayjs()
      .subtract(staleDays.value || 0, 'day')
      .startOf('day')
      .format('YYYY-MM-DD'),
  });

const conditionWhere = computed(() =>
  conditions
    .filter(c => c.column && c.operator && c.value !== '')
    .map(c => `${c.column}.${c.operator}.${c.value}`)
    .join(','),
);

const runConditionalCrawl = () => {
  const where = conditionWhere.value;
  if (!where) return;
  store.startCrawl(
    { mode: 'recrawl-cond', where },
    `條件重抓: ${where}`,
  );
};

const logRef = ref<HTMLDivElement | null>(null);
watch(
  () => store.crawlProgress.length,
  async () => {
    await nextTick();
    if (logRef.value)
      logRef.value.scrollTop = logRef.value.scrollHeight;
  },
);

const fmtDate = (d?: string) =>
  d ? dayjs(d).format('M/D') : '—';

const fmtRangeStart = (d?: string) =>
  d
    ? dayjs(d).subtract(store.statsDays, 'day').format('M/D')
    : '—';

onMounted(() => store.init());

const recrawlRow = (id: string) =>
  store.startCrawl(
    { mode: 'recrawl-ids', ids: [id] },
    `重抓單筆 ${id}`,
  );

const recrawlSalaryBulk = () =>
  store.startCrawl(
    {
      mode: 'recrawl-anomaly',
      kind: 'salary',
      monthCeil: store.salaryThreshold.monthCeil,
      yearCeil: store.salaryThreshold.yearCeil,
    },
    '整批重抓：薪資異常',
  );

const recrawlEmptyBulk = () =>
  store.startCrawl(
    { mode: 'recrawl-anomaly', kind: 'empty-description' },
    '整批重抓：空 description',
  );
</script>

<template>
  <div class="w-full">
    <header class="mb-6">
      <h1 class="text-on-surface text-2xl font-black">
        職缺更新監控
      </h1>
      <p class="text-on-surface-variant mt-1 text-sm">
        爬蟲產出狀況與資料品質檢查（僅限管理員）
      </p>
    </header>

    <div
      class="text-on-surface-variant mb-3 flex flex-wrap items-center gap-2 text-sm"
    >
      <span class="font-semibold">統計區間</span>
      <span>近</span>
      <input
        v-model.number="statsDays"
        type="number"
        min="0"
        class="border-surface-container bg-surface-container text-on-surface w-20 rounded-lg border px-2 py-1 text-sm"
        @keyup.enter="store.applyStatsDays(statsDays)"
      />
      <span>天</span>
      <button
        class="border-surface-container text-on-surface-variant hover:bg-surface-container cursor-pointer rounded-lg border px-3 py-1 text-sm transition"
        :disabled="store.statsLoading"
        @click="store.applyStatsDays(statsDays)"
      >
        套用
      </button>
    </div>

    <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div
        class="border-surface-container bg-surface-container-lowest rounded-2xl border p-5"
      >
        <div
          class="text-on-surface-variant flex items-center gap-2 text-sm font-semibold"
        >
          <span class="material-symbols-outlined text-primary"
            >fiber_new</span
          >
          新職缺數量
        </div>
        <div class="text-on-surface mt-2 text-3xl font-black">
          {{
            store.stats
              ? formatNumber(store.stats.new_jobs_count)
              : '—'
          }}
        </div>
        <div class="text-on-surface-variant mt-1 text-xs">
          {{ fmtRangeStart(store.stats?.new_jobs_date) }} - {{ fmtDate(store.stats?.new_jobs_date) }}
        </div>
      </div>

      <div
        class="border-surface-container bg-surface-container-lowest rounded-2xl border p-5"
      >
        <div
          class="text-on-surface-variant flex items-center gap-2 text-sm font-semibold"
        >
          <span class="material-symbols-outlined text-primary"
            >update</span
          >
          最近更新職缺數量
        </div>
        <div class="text-on-surface mt-2 text-3xl font-black">
          {{
            store.stats
              ? formatNumber(store.stats.updated_jobs_count)
              : '—'
          }}
        </div>
        <div class="text-on-surface-variant mt-1 text-xs">
          {{ fmtRangeStart(store.stats?.updated_jobs_date) }} - {{ fmtDate(store.stats?.updated_jobs_date) }}
        </div>
      </div>
    </div>

    <section
      class="border-surface-container bg-surface-container-lowest mb-8 rounded-2xl border p-5"
    >
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary"
          >travel_explore</span
        >
        <h3 class="text-on-surface font-bold mb-0">爬蟲控制</h3>
        <span
          v-if="store.crawlRunning"
          class="material-symbols-outlined text-primary animate-spin text-base"
          >progress_activity</span
        >
      </div>

      <div class="mt-4 flex flex-wrap items-end gap-3">
        <button
          class="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="store.crawlRunning"
          @click="
            store.startCrawl({ mode: 'crawl' }, '啟動爬蟲（resume）')
          "
        >
          啟動爬蟲（resume）
        </button>
        <button
          class="border-primary text-primary hover:bg-primary-container cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="store.crawlRunning"
          @click="
            store.startCrawl(
              { mode: 'fresh' },
              '重新開始爬蟲（fresh）',
            )
          "
        >
          重新開始（fresh）
        </button>

      </div>

      <div
        class="border-surface-container mt-5 rounded-xl border p-4"
      >
        <div
          class="text-on-surface-variant mb-3 flex items-center gap-2 text-sm font-semibold"
        >
          <span class="material-symbols-outlined text-base"
            >filter_alt</span
          >
          條件重抓（自訂篩選參數）
        </div>

        <div class="flex flex-col gap-2">
          <div
            v-for="(c, i) in conditions"
            :key="i"
            class="flex flex-wrap items-center gap-2"
          >
            <select
              v-model="c.column"
              class="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 pr-8 pl-2 text-sm"
            >
              <option
                v-for="col in conditionColumns"
                :key="col.value"
                :value="col.value"
              >
                {{ col.label }}
              </option>
            </select>
            <select
              v-model="c.operator"
              class="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 pr-8 pl-2 text-sm"
            >
              <option
                v-for="op in conditionOperators"
                :key="op.value"
                :value="op.value"
              >
                {{ op.label }}
              </option>
            </select>
            <input
              v-model="c.value"
              type="text"
              placeholder="值（例如 2026-05-01 / month / %台北%）"
              class="border-surface-container bg-surface-container text-on-surface min-w-56 flex-1 rounded-lg border px-2 py-1.5 text-sm"
            />
            <button
              class="text-on-surface-variant hover:text-on-surface flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition"
              title="移除此條件"
              @click="removeCondition(i)"
            >
              <span class="material-symbols-outlined text-base"
                >close</span
              >
            </button>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-end gap-3">
          <button
            class="border-surface-container text-on-surface-variant hover:bg-surface-container cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition"
            @click="addCondition()"
          >
            ＋ 新增條件
          </button>

          <label
            class="text-on-surface-variant flex items-end gap-1 text-xs"
          >
            快速：N 天未更新
            <input
              v-model.number="staleDays"
              type="number"
              min="0"
              class="border-surface-container bg-surface-container text-on-surface w-20 rounded-lg border px-2 py-1 text-sm"
            />
            <button
              class="border-surface-container text-on-surface-variant hover:bg-surface-container cursor-pointer rounded-lg border px-2 py-1 transition"
              @click="addStaleCondition()"
            >
              加入
            </button>
          </label>
        </div>

        <div
          class="text-on-surface-variant mt-3 flex flex-wrap items-center gap-2 text-xs"
        >
          <span class="font-semibold">where 預覽：</span>
          <code
            class="bg-surface-container text-on-surface rounded px-2 py-1 font-mono"
            >{{ conditionWhere || '（尚無有效條件）' }}</code
          >
        </div>

        <button
          class="bg-primary text-on-primary hover:bg-primary/90 mt-3 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="store.crawlRunning || !conditionWhere"
          @click="runConditionalCrawl()"
        >
          條件重抓
        </button>
      </div>

      <div
        v-if="store.crawlProgress.length || store.crawlRunning || store.crawlDone"
        class="border-surface-container mt-4 overflow-hidden rounded-lg border"
      >
        <div
          class="bg-surface-container flex items-center justify-between px-3 py-2"
        >
          <span
            class="text-on-surface-variant text-sm font-bold tracking-widest"
            >{{ store.crawlLabel || '爬取進度' }}</span
          >
          <button
            v-if="store.crawlDone"
            class="text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors"
            @click="store.clearCrawlLog()"
          >
            ✕
          </button>
          <span
            v-else
            class="material-symbols-outlined text-primary animate-spin text-sm"
            >progress_activity</span
          >
        </div>
        <div
          ref="logRef"
          class="bg-surface-container-lowest max-h-64 overflow-y-auto p-3 font-mono text-[11px]"
        >
          <div
            v-for="(line, i) in store.crawlProgress"
            :key="i"
            class="text-on-surface-variant leading-5 break-all whitespace-pre-wrap"
          >
            {{ line }}
          </div>
          <div
            v-if="!store.crawlProgress.length"
            class="text-on-surface-variant/50 italic"
          >
            啟動中…
          </div>
        </div>
      </div>
    </section>

    <section
      class="border-surface-container bg-surface-container-lowest mb-8 overflow-hidden rounded-2xl border"
    >
      <header
        class="bg-surface-container flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3"
      >
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary"
            >calendar_month</span
          >
          <h3 class="text-on-surface mb-0 font-bold">
            每日更新統計
          </h3>
        </div>
        <button
          class="bg-primary text-on-primary hover:bg-primary/90 flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="
            store.crawlRunning || !store.selectedDates.length
          "
          @click="store.recrawlSelectedDates()"
        >
          <span class="material-symbols-outlined text-sm"
            >bug_report</span
          >
          重抓選取日期（{{ store.selectedDates.length }}）
        </button>
      </header>

      <div class="max-h-96 overflow-auto">
        <div
          v-if="store.updateDatesLoading"
          class="text-on-surface-variant px-3 sm:px-5 py-8 text-center text-sm"
        >
          載入中…
        </div>
        <table
          v-else
          class="w-full border-collapse text-left text-sm"
        >
          <thead
            class="bg-surface-container-lowest sticky top-0"
          >
            <tr
              class="text-on-surface-variant border-surface-container border-b text-xs"
            >
              <th class="w-10 px-3 sm:px-5 py-2">
                <input
                  type="checkbox"
                  class="accent-primary cursor-pointer"
                  :checked="
                    store.updateDateCounts.length > 0 &&
                    store.selectedDates.length ===
                      store.updateDateCounts.length
                  "
                  @change="store.toggleAllDates()"
                />
              </th>
              <th class="px-3 sm:px-5 py-2 font-semibold">更新日期</th>
              <th class="px-3 sm:px-5 py-2 text-right font-semibold">
                數量
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in store.updateDateCounts"
              :key="row.updated_date"
              class="border-surface-container/60 hover:bg-surface-container/40 cursor-pointer border-b transition"
              @click="store.toggleDate(row.updated_date)"
            >
              <td class="px-3 sm:px-5 py-2" @click.stop>
                <input
                  type="checkbox"
                  class="accent-primary cursor-pointer"
                  :checked="
                    store.selectedDates.includes(
                      row.updated_date,
                    )
                  "
                  @change="store.toggleDate(row.updated_date)"
                />
              </td>
              <td
                class="text-on-surface px-3 sm:px-5 py-2 font-medium whitespace-nowrap"
              >
                {{ row.updated_date }}
              </td>
              <td
                class="text-on-surface-variant px-3 sm:px-5 py-2 text-right tabular-nums"
              >
                {{ formatNumber(row.count) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="flex flex-col gap-8">
      <AnomalyTable
        title="薪資不合預期"
        icon="payments"
        :count="store.salary.count"
        :loading="store.salary.loading"
        :items="store.salary.items"
        :page="store.salary.page"
        :page-size="store.pageSize"
        value-column="salary"
        value-label="薪資（min ~ max）"
        editable-salary
        :crawl-running="store.crawlRunning"
        @update:page="store.loadSalary($event)"
        @recrawl-row="recrawlRow"
        @recrawl-bulk="recrawlSalaryBulk"
        @save-salary="
          store.saveSalary(
            $event.id,
            $event.min,
            $event.max,
            $event.type,
          )
        "
      />

      <LocationGroupTable
        :groups="store.locationGroupRows"
        :selected-keys="store.selectedLocationGroups"
        :loading="store.unmappedLoading"
        :crawl-running="store.crawlRunning"
        @toggle="store.toggleLocationGroup($event)"
        @toggle-all="store.toggleAllLocationGroups()"
        @recrawl-selected="
          store.recrawlSelectedLocationGroups()
        "
      />

      <AnomalyTable
        title="職缺描述為空"
        icon="description"
        :count="store.emptyDescription.count"
        :loading="store.emptyDescription.loading"
        :items="store.emptyDescription.items"
        :page="store.emptyDescription.page"
        :page-size="store.pageSize"
        value-column="none"
        :crawl-running="store.crawlRunning"
        @update:page="store.loadEmptyDescription($event)"
        @recrawl-row="recrawlRow"
        @recrawl-bulk="recrawlEmptyBulk"
      />
    </div>
  </div>
</template>
