import { TechFilterPanel } from '../../../components/TechFilterPanel';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useKeywordCatalogView } from '../../keyword/useKeywordCatalogView';

// Thin wrapper (task 7.2) connecting the job page's existing keyword
// selection store to the parameterized catalog view hook (task 1.2) and the
// shared TechFilterPanel presentation (task 1.3). Mirrors
// CompanyTechFilterPanel.tsx (task 3.2); only the store differs.
export function JobTechFilterPanel() {
  const view = useKeywordCatalogView(useKeywordFilterStore);
  return <TechFilterPanel {...view} />;
}
