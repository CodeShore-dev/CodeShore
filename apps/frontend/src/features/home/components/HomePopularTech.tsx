import { KeywordTechRankingCardList } from '../../../components/KeywordTechRankingCardList';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useKeywordTechRanking } from '../hooks/useKeywordTechRanking';

interface HomePopularTechProps {
  ranking: ReturnType<typeof useKeywordTechRanking>;
}

// Receives the shared popular-tech ranking from HomePage so the page can also
// derive the list of techs for HomeHotCombos (mirrors the Vue shared store
// instance).
export function HomePopularTech({ ranking }: HomePopularTechProps) {
  return (
    <KeywordTechRankingCardList
      title="熱門技術"
      items={ranking.items}
      loading={ranking.loading}
      getItems={ranking.getItems}
      moreTo="/techs?mode=popular"
      titleHint={<InfoHint metric="home.popularTech" />}
    />
  );
}
