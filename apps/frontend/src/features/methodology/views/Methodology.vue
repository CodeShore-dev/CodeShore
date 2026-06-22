<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { metricExplanations } from '../content/metrics';
import { methodologySections } from '../content/sections';
import { fetchMethodologySql } from '../service';

const sqlMap = ref<Record<string, string>>({});

// 收集所有 metric 引用到的資料庫物件，依首次出現順序排列，
// 並記錄各物件被哪些分析數字使用，於頁面顯示來源 SQL。
const sqlObjects = computed(() => {
  const used = new Map<string, string[]>();
  for (const metric of Object.values(metricExplanations)) {
    for (const name of metric.sqlObjects) {
      const titles = used.get(name) ?? [];
      if (!titles.includes(metric.title)) {
        titles.push(metric.title);
      }
      used.set(name, titles);
    }
  }
  return [...used.entries()].map(([name, usedBy]) => ({
    name,
    usedBy,
  }));
});

onMounted(async () => {
  try {
    sqlMap.value = await fetchMethodologySql();
  } catch {
    sqlMap.value = {};
  }
});
</script>

<template>
  <div class="w-full">
    <div class="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 class="mb-2 text-2xl font-black text-[#001f2a]">
        公開透明
      </h1>
      <p class="mb-10 text-sm text-[#434653]">
        本頁完整揭露 CodeShore
        的資料來源、網站架構、資料庫設計與效能取捨。
      </p>

      <section
        v-for="section in methodologySections"
        :id="section.id"
        :key="section.id"
        class="mb-12 scroll-mt-20"
      >
        <h2 class="mb-4 text-xl font-black text-[#003d92]">
          {{ section.title }}
        </h2>

        <template
          v-for="(block, index) in section.blocks"
          :key="index"
        >
          <p
            v-if="block.kind === 'paragraph'"
            class="mb-4 text-sm leading-relaxed text-[#1f2330]"
          >
            {{ block.text }}
          </p>

          <ul
            v-else-if="block.kind === 'list'"
            class="mb-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#1f2330]"
          >
            <li v-for="(item, i) in block.items" :key="i">
              {{ item }}
            </li>
          </ul>

          <div
            v-else-if="block.kind === 'table'"
            class="mb-4 w-full overflow-x-auto"
          >
            <table
              class="w-full border-collapse text-left text-sm text-[#1f2330]"
            >
              <thead>
                <tr>
                  <th
                    v-for="(header, h) in block.headers"
                    :key="h"
                    class="border-b border-[#d4d7e0] py-2 pr-4 align-top font-bold text-[#434653]"
                  >
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, r) in block.rows" :key="r">
                  <td
                    v-for="(cell, c) in row"
                    :key="c"
                    class="border-b border-[#eceef3] py-2 pr-4 align-top leading-relaxed"
                  >
                    {{ cell }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <section id="source-sql" class="mb-12 scroll-mt-20">
        <h2 class="mb-2 text-xl font-black text-[#003d92]">
          資料來源 SQL
        </h2>
        <p
          class="mb-6 text-sm leading-relaxed text-[#1f2330]"
        >
          以下是各分析數字背後實際使用的資料庫物件定義，於建置時自
          schema.sql 擷取。
        </p>

        <div
          v-for="obj in sqlObjects"
          :id="`sql-${obj.name}`"
          :key="obj.name"
          class="mb-6 scroll-mt-20"
        >
          <h3
            class="font-mono text-sm font-bold break-all text-[#001f2a]"
          >
            {{ obj.name }}
          </h3>
          <p class="mb-2 text-xs text-[#434653]">
            用於：{{ obj.usedBy.join('、') }}
          </p>
          <pre
            v-if="sqlMap[obj.name]"
            class="overflow-x-auto rounded-lg bg-[#001f2a] p-4 text-xs leading-relaxed text-[#d9f2ff]"
          ><code>{{ sqlMap[obj.name] }}</code></pre>
          <p
            v-else
            class="rounded-lg bg-[#f4faff] p-4 text-xs text-[#434653]"
          >
            SQL 載入中…
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
