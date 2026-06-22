<script lang="ts" setup>
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import TechIcon from '../../../components/TechIcon.vue';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWan } from '../../../utils/format';
import InfoHint from '../../methodology/components/InfoHint.vue';
import useTechComboStats from '../composables/useTechComboStats';

type Props = {
  tech: string;
};

const props = withDefaults(defineProps<Props>(), {});

const { items, getItems, loading } = useTechComboStats();

const router = useRouter();

const topCombo = computed(() => items.value[0]);
const smallCombos = computed(() => items.value.slice(1, 5));
const techLabel = computed(
  () => topCombo.value?.tech1_label ?? props.tech,
);

function goJobs(query: Record<string, string> = {}) {
  router.push({ name: 'jobs', query });
}

watch(
  () => props.tech,
  value => {
    getItems({
      where: {
        tech1: { eq: value },
        cat2: { neq: 'language' },
      },
    });
  },
  { immediate: true },
);
</script>

<template>
  <section
    v-show="loading || items.length > 0"
    class="mb-6"
  >
    <div
      class="mb-2 flex items-center gap-1.5 text-base font-black text-[#001f2a]"
    >
      <span>
        與
        <span class="text-[#003d92]">{{ techLabel }}</span>
        語言最常同時出現的技術組合
      </span>
      <InfoHint metric="home.hotCombos" />
    </div>

    <div
      v-if="loading"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]"
    >
      <div
        class="col-span-1 h-60 animate-pulse rounded-xl bg-[#d9f2ff] sm:col-span-2 md:col-span-1 md:row-span-2 md:h-72"
      />
      <div
        v-for="i in 4"
        :key="i"
        class="h-32 animate-pulse rounded-xl bg-[#d9f2ff]"
      />
    </div>

    <div
      v-else-if="topCombo"
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]"
    >
      <button
        class="group col-span-1 flex min-w-0 cursor-pointer flex-col justify-between rounded-xl bg-[#001f2a] p-6 text-left text-white transition-all hover:opacity-95 active:scale-[0.98] sm:col-span-2 md:col-span-1 md:row-span-2"
        style="min-height: clamp(200px, 50vw, 280px)"
        @click="
          goJobs({
            tags: `${topCombo.tech1},${topCombo.tech2}`,
          })
        "
      >
        <div>
          <div
            class="mb-4 flex items-center justify-between font-mono text-[11px] tracking-[0.15em] text-white/50"
          >
            <span>#1</span>
            <span
              class="flex items-center gap-1 font-sans font-bold tracking-normal text-[#fd7700]"
            >
              前往職缺
              <span
                class="material-symbols-outlined transition-transform group-hover:translate-x-0.5"
                style="font-size: 14px"
                >arrow_forward</span
              >
            </span>
          </div>
          <div class="flex flex-col gap-2">
            <div
              class="flex flex-col gap-1 leading-none font-black tracking-[-0.03em]"
              style="
                font-size: clamp(1.75rem, 7vw, 3.25rem);
              "
            >
              <div class="flex min-w-0 items-center gap-2">
                <TechIcon
                  :slugs="topCombo.tech1_icons"
                  :label="topCombo.tech1_label"
                />
                <span class="min-w-0 wrap-break-word">{{
                  topCombo.tech1_label
                }}</span>
              </div>
              <span class="text-[#fd7700]">+</span>
              <div class="flex min-w-0 items-center gap-2">
                <TechIcon
                  :slugs="topCombo.tech2_icons"
                  :label="topCombo.tech2_label"
                />
                <span class="min-w-0 wrap-break-word">{{
                  topCombo.tech2_label
                }}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="tag in topCombo.tech2_tags ?? []"
                :key="tag"
                class="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70"
              >
                {{ TAG_LABEL_MAP[tag] ?? tag }}
              </span>
            </div>
          </div>
        </div>
        <div class="mt-4 flex items-end justify-between">
          <div>
            <div
              class="leading-none font-black tracking-[-0.02em] text-[#fd7700] tabular-nums"
              style="font-size: clamp(1.5rem, 5vw, 2.5rem)"
            >
              {{ topCombo.job_count.toLocaleString() }}
            </div>
            <div class="mt-0.5 text-[11px] text-white/50">
              個職缺
            </div>
          </div>
          <div>
            <div class="text-right">
              <div class="text-xl font-black tabular-nums">
                {{ toWan(topCombo.median_min_year) }}–{{
                  toWan(topCombo.median_max_year)
                }}
              </div>
              <div class="text-[11px] text-white/50">
                年薪
              </div>
            </div>
            <div class="text-right">
              <div class="text-xl font-black tabular-nums">
                {{ toWan(topCombo.median_min_month) }}–{{
                  toWan(topCombo.median_max_month)
                }}
              </div>
              <div class="text-[11px] text-white/50">
                月薪
              </div>
            </div>
          </div>
        </div>
      </button>

      <button
        v-for="(combo, i) in smallCombos"
        :key="`${combo.tech1}+${combo.tech2}`"
        class="group flex min-w-0 cursor-pointer flex-col justify-between rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        style="min-height: 130px"
        @click="
          goJobs({ tags: `${combo.tech1},${combo.tech2}` })
        "
      >
        <div
          class="flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-[#434653]"
        >
          <span>#{{ i + 2 }}</span>
          <span
            class="flex items-center gap-0.5 font-sans font-bold tracking-normal text-[#003d92]"
          >
            前往職缺
            <span
              class="material-symbols-outlined transition-transform group-hover:translate-x-0.5"
              style="font-size: 13px"
              >arrow_forward</span
            >
          </span>
        </div>
        <div
          class="mt-2 flex flex-col gap-1 leading-tight font-black tracking-[-0.02em] text-[#001f2a]"
          style="font-size: 1.375rem"
        >
          <div class="flex min-w-0 items-center gap-1.5">
            <TechIcon
              :slugs="combo.tech1_icons"
              :label="combo.tech1_label"
            />
            <span class="min-w-0 wrap-break-word">{{
              combo.tech1_label
            }}</span>
          </div>
          <span class="px-2 text-[#fd7700]">+</span>
          <div class="flex min-w-0 items-center gap-1.5">
            <TechIcon
              :slugs="combo.tech2_icons"
              :label="combo.tech2_label"
            />
            <span class="min-w-0 wrap-break-word">{{
              combo.tech2_label
            }}</span>
          </div>
        </div>
        <div class="mt-1.5 flex flex-wrap gap-1">
          <span
            v-for="tag in combo.tech2_tags ?? []"
            :key="tag"
            class="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#434653]"
          >
            {{ TAG_LABEL_MAP[tag] ?? tag }}
          </span>
        </div>
        <div class="mt-2 flex items-end justify-between">
          <div>
            <div
              class="leading-none font-black text-[#003d92] tabular-nums"
              style="font-size: 1.375rem"
            >
              {{ combo.job_count.toLocaleString() }}
            </div>
            <div class="text-[10px] text-[#434653]">
              個職缺
            </div>
          </div>
          <div class="text-[11px]">
            <div>
              <div class="text-right">
                <div
                  class="font-bold text-[#434653] tabular-nums"
                >
                  {{ toWan(combo.median_min_year) }}–{{
                    toWan(combo.median_max_year)
                  }}
                </div>
                <div class="text-[11px]">年薪</div>
              </div>
              <div class="text-right">
                <div
                  class="font-bold text-[#434653] tabular-nums"
                >
                  {{ toWan(combo.median_min_month) }}–{{
                    toWan(combo.median_max_month)
                  }}
                </div>
                <div class="text-[11px]">月薪</div>
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  </section>
</template>
