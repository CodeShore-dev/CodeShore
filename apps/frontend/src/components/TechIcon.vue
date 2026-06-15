<script lang="ts" setup>
import { v4 as uuid } from 'uuid';
import { computed, ref, watch } from 'vue';

import {
  loadProcessedIcon,
  namespaceIds,
} from '../utils/svgRecolor';

const uid = `ti_${uuid()}`;

const SOURCE_URL: Record<string, (slug: string) => string> =
  {
    'simple-icons': slug =>
      `https://cdn.simpleicons.org/${slug}`,
    thesvg: slug =>
      `https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/${slug.includes('/') ? slug : `${slug}/default`}.svg`,
    iconify: slug =>
      `https://api.iconify.design/${slug}.svg`,
  };

const props = withDefaults(
  defineProps<{
    slugs?: string[] | null;
    label?: string | null;
    size?: number;
    hideIfNotFound?: boolean;
  }>(),
  {
    slugs: null,
    label: '',
    size: 32,
    hideIfNotFound: true,
  },
);

const sources = computed<string[]>(() =>
  (props.slugs ?? [])
    .map(entry => {
      const sep = entry.indexOf(':');
      if (sep < 0) return null;
      const builder = SOURCE_URL[entry.slice(0, sep)];
      return builder ? builder(entry.slice(sep + 1)) : null;
    })
    .filter((url): url is string => !!url),
);

const markup = ref<string | null>(null);
const settled = ref(false);

let seq = 0;
async function resolve(urls: string[]): Promise<void> {
  const mine = ++seq;
  markup.value = null;
  settled.value = false;
  for (const url of urls) {
    const svg = await loadProcessedIcon(url);
    if (mine !== seq) return;
    if (svg) {
      markup.value = namespaceIds(svg, uid);
      settled.value = true;
      return;
    }
  }
  if (mine === seq) settled.value = true;
}

watch(sources, resolve, { immediate: true });

const initial = computed(() =>
  (props.label?.trim()?.[0] ?? '?').toUpperCase(),
);
</script>

<template>
  <span
    v-if="!props.hideIfNotFound || !settled || markup"
    class="techicon inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#eef3f8] bg-white"
    :style="{
      width: `${size + 8}px`,
      height: `${size + 8}px`,
    }"
  >
    <span
      v-if="markup"
      class="techicon-svg inline-flex"
      :style="{ width: `${size}px`, height: `${size}px` }"
      v-html="markup"
    />
    <span
      v-else-if="settled"
      class="font-black text-[#003d92]"
      :style="{ fontSize: `${Math.round(size * 0.6)}px` }"
    >
      {{ initial }}
    </span>
  </span>
</template>

<style scoped>
.techicon {
  color: #001f2a;
}
.techicon-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
