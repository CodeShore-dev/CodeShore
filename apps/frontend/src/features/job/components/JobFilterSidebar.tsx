import { SearchInput } from '../../../components/SearchInput';
import { useDebouncedStoreSync } from '../../../hooks/useDebouncedStoreSync';
import { useJobFilterStore } from '../jobFilterStore';
import { JobKeywordFilterPanel } from './JobKeywordFilterPanel';
import { JobLocationFilterPanel } from './JobLocationFilterPanel';
import { JobSalaryFilterPanel } from './JobSalaryFilterPanel';

// Job filter sidebar content (task 7.5), ported from JobFilterSidebar.vue.
// Composed from per-concern panels (keyword/location/salary) to stay under
// the 200-line component limit; search-text debouncing is shared via
// useDebouncedStoreSync instead of being hand-rolled per field.
export function JobFilterSidebar() {
  const searchText = useJobFilterStore(s => s.searchText);
  const companySearchText = useJobFilterStore(s => s.companySearchText);
  const setSearchText = useJobFilterStore(s => s.setSearchText);
  const setCompanySearchText = useJobFilterStore(s => s.setCompanySearchText);

  const [localSearch, setLocalSearch] = useDebouncedStoreSync(
    searchText,
    setSearchText,
    400,
  );
  const [localCompany, setLocalCompany] = useDebouncedStoreSync(
    companySearchText,
    setCompanySearchText,
    400,
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <SearchInput
          value={localSearch}
          placeholder="搜尋職缺..."
          onChange={setLocalSearch}
        />
        <SearchInput
          value={localCompany}
          placeholder="搜尋公司名稱..."
          onChange={setLocalCompany}
        />
      </section>

      <JobKeywordFilterPanel />
      <JobLocationFilterPanel />
      <JobSalaryFilterPanel />
    </div>
  );
}
