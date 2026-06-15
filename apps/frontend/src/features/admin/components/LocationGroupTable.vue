<script setup lang="ts">
import dayjs from 'dayjs';
import { reactive } from 'vue';

import { AnomalyJob } from '../service';

type LocationGroupRow = {
  key: string;
  location: string;
  count: number;
  jobs: AnomalyJob[];
};

type Props = {
  groups: LocationGroupRow[];
  selectedKeys: string[];
  loading: boolean;
  crawlRunning: boolean;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [key: string];
  'toggle-all': [];
  'recrawl-selected': [];
}>();

const expanded = reactive<Record<string, boolean>>({});
const toggleExpand = (key: string) =>
  (expanded[key] = !expanded[key]);

const fmt = (d: string) =>
  d ? dayjs(d).format('YYYY-MM-DD') : '—';
</script>

<template>
  <section
    class="border-surface-container bg-surface-container-lowest overflow-hidden rounded-2xl border"
  >
    <header
      class="bg-surface-container flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-3"
    >
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary"
          >location_on</span
        >
        <h3 class="text-on-surface mb-0 font-bold">
          地點未歸類
        </h3>
        <span
          class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-bold"
          >{{ groups.length }} 組</span
        >
      </div>
      <button
        class="bg-primary text-on-primary hover:bg-primary/90 flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="crawlRunning || !selectedKeys.length"
        @click="emit('recrawl-selected')"
      >
        <span class="material-symbols-outlined text-sm"
          >bug_report</span
        >
        重抓選取（{{ selectedKeys.length }} 組）
      </button>
    </header>

    <div class="overflow-x-auto">
      <div
        v-if="loading"
        class="text-on-surface-variant px-3 sm:px-5 py-8 text-center text-sm"
      >
        載入中…
      </div>
      <div
        v-else-if="groups.length === 0"
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
            <th class="w-10 px-3 sm:px-5 py-2">
              <input
                type="checkbox"
                class="accent-primary cursor-pointer"
                :checked="
                  groups.length > 0 &&
                  selectedKeys.length === groups.length
                "
                @change="emit('toggle-all')"
              />
            </th>
            <th class="px-3 sm:px-5 py-2 font-semibold">地點</th>
            <th class="px-3 sm:px-5 py-2 text-right font-semibold">
              職缺數
            </th>
            <th class="w-10 px-3 sm:px-5 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in groups" :key="g.key">
            <tr
              class="border-surface-container/60 hover:bg-surface-container/40 cursor-pointer border-b transition"
              @click="toggleExpand(g.key)"
            >
              <td class="px-3 sm:px-5 py-2" @click.stop>
                <input
                  type="checkbox"
                  class="accent-primary cursor-pointer"
                  :checked="selectedKeys.includes(g.key)"
                  @change="emit('toggle', g.key)"
                />
              </td>
              <td
                class="text-on-surface px-3 sm:px-5 py-2 font-medium"
              >
                {{ g.location }}
              </td>
              <td
                class="text-on-surface-variant px-3 sm:px-5 py-2 text-right tabular-nums"
              >
                {{ g.count }}
              </td>
              <td class="px-3 sm:px-5 py-2 text-right">
                <span
                  class="material-symbols-outlined text-on-surface-variant text-base transition"
                  :class="{ 'rotate-180': expanded[g.key] }"
                  >expand_more</span
                >
              </td>
            </tr>
            <tr v-if="expanded[g.key]" :key="g.key + '-x'">
              <td colspan="3" class="px-3 sm:px-5 pt-1 pb-3">
                <div
                  class="border-surface-container/60 flex flex-col gap-1 border-l pl-3"
                >
                  <div
                    v-for="job in g.jobs"
                    :key="job.id"
                    class="flex items-center justify-between gap-3 text-xs"
                  >
                    <a
                      :href="job.detail_link"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary line-clamp-1 hover:underline"
                      >{{ job.title || '(無標題)' }}</a
                    >
                    <span
                      class="text-on-surface-variant shrink-0"
                    >
                      {{ job.location || '—' }} ·
                      {{ fmt(job.updated_at) }}
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>
