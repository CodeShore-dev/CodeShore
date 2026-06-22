<script lang="ts" setup>
import { methodologySections } from '../content/sections';
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
    </div>
  </div>
</template>
