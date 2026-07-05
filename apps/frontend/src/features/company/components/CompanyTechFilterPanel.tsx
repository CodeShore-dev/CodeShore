import { TechFilterPanel } from '../../../components/TechFilterPanel';
import { useKeywordCatalogView } from '../../keyword/useKeywordCatalogView';
import { useCompanyTechFilterStore } from '../companyTechFilterStore';

// Thin wrapper (task 3.2) connecting the company page's independent tech
// selection store (task 3.1) and the parameterized catalog view hook
// (task 1.2) to the shared TechFilterPanel presentation (task 1.3). Mirrors
// the shape JobTechFilterPanel will move to in task 7.2; only the store
// differs, so selections here never affect the job page's filter state.
export function CompanyTechFilterPanel() {
  const view = useKeywordCatalogView(useCompanyTechFilterStore);
  return <TechFilterPanel {...view} searchPlaceholder="搜尋技術..." />;
}
