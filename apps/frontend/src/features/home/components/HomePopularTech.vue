<script lang="ts" setup>
import KeywordTechRankingCardList from '../../../components/KeywordTechRankingCardList.vue';
import InfoHint from '../../methodology/components/InfoHint.vue';
import { useHomeStore } from '../useHomeStore';

const store = useHomeStore();
</script>

<template>
  <div class="relative">
    <KeywordTechRankingCardList
      title="熱門技術"
      :items="store.keywordTechRanking.items"
      :loading="store.keywordTechRanking.loading"
      :get-items="store.keywordTechRanking.getItems"
      :more-to="{
        name: 'techs',
        query: { mode: 'popular' },
      }"
    />
    <InfoHint
      metric="home.popularTech"
      class="absolute top-10 left-[5.5rem]"
    />
  </div>
</template>
