<script lang="ts" setup>
import KeywordTechRankingCardList from '../../../components/KeywordTechRankingCardList.vue';
import { useHomeStore } from '../useHomeStore';

const store = useHomeStore();
</script>

<template>
  <KeywordTechRankingCardList
    title="熱門技術"
    :items="store.keywordTechRanking.items"
    :loading="store.keywordTechRanking.loading"
    :get-items="store.keywordTechRanking.getItems"
    :more-to="{ name: 'techs', query: { mode: 'popular' } }"
  />
</template>
