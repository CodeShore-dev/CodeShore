import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import { Pagination } from '../../../components/Pagination';
import {
  useKeywordCategoriesQuery,
  useTechsQuery,
} from '../../keyword/queries';
import { InfoHint } from '../../methodology/components/InfoHint';
import { CompanyCard } from '../components/CompanyCard';
import { CompanyKeywordFilter } from '../components/CompanyKeywordFilter';
import {
  selectCompanyHasActiveFilters,
  useCompanyFilterStore,
} from '../companyFilterStore';
import { useCompaniesQuery } from '../queries';

export function CompanyListPage() {
  const navigate = useNavigate();
  const { companies, totalCount, totalPages, loading } = useCompaniesQuery();

  const search = useCompanyFilterStore(s => s.search);
  const setSearch = useCompanyFilterStore(s => s.setSearch);
  const page = useCompanyFilterStore(s => s.page);
  const setPage = useCompanyFilterStore(s => s.setPage);
  const selectedTechs = useCompanyFilterStore(
    s => s.selectedTechs,
  );
  const clearFilters = useCompanyFilterStore(s => s.clearFilters);
  const hasActiveFilters = useCompanyFilterStore(
    selectCompanyHasActiveFilters,
  );

  const { data: techs = [] } = useTechsQuery();
  const { tabs } = useKeywordCategoriesQuery();
  const categoryLabelMap = useMemo(
    () => Object.fromEntries(tabs.map(t => [t.value, t.label])),
    [tabs],
  );

  const goToJobs = (companyName: string) =>
    navigate(`/jobs?${new URLSearchParams({ company: companyName })}`);

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 公司列表 · COMPANIES
        </div>
        <div className="flex items-end justify-between gap-4">
          <h1 className="flex items-start gap-1.5 text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
            <span>
              誰在徵人，<br className="sm:hidden" />徵什麼
            </span>
            <InfoHint metric="company.list" />
          </h1>
          <div className="flex shrink-0 items-center gap-3 pb-1">
            {hasActiveFilters && (
              <button
                type="button"
                className="cursor-pointer text-sm font-bold text-[#003d92]"
                onClick={clearFilters}
              >
                清除篩選
              </button>
            )}
            {!loading && (
              <span className="text-sm font-semibold text-[#434653]">
                共 {totalCount} 間
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col flex-wrap gap-2 md:flex-row md:items-start">
        <div className="relative flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base! text-[#434653]/50">
            search
          </span>
          <input
            value={search}
            type="text"
            placeholder="搜尋公司名稱..."
            className="w-full rounded-xl border border-[#c3c6d5] bg-white py-2.5 pr-8 pl-9 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:border-[#003d92] focus:outline-none"
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="absolute top-1/2 right-3 flex -translate-y-1/2 cursor-pointer text-[#434653]/50 hover:text-[#001f2a]"
              onClick={() => setSearch('')}
            >
              <span className="material-symbols-outlined text-base">
                close
              </span>
            </button>
          )}
        </div>
        <CompanyKeywordFilter />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="flex animate-pulse flex-col gap-3.5 rounded-[20px] bg-white p-6 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-6 w-36 rounded bg-[#001f2a]/[0.08]" />
                  <div className="h-3 w-20 rounded bg-[#001f2a]/[0.08]" />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="h-7 w-10 rounded bg-[#001f2a]/[0.08]" />
                  <div className="h-3 w-10 rounded bg-[#001f2a]/[0.08]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="py-24 text-center">
          <div className="mb-3 text-5xl font-black text-[#001f2a]/10">0</div>
          <p className="text-sm font-bold text-[#434653]">沒有符合條件的公司</p>
          {hasActiveFilters && (
            <button
              type="button"
              className="mt-4 cursor-pointer rounded-xl bg-[#003d92] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9] active:scale-95"
              onClick={clearFilters}
            >
              清除篩選條件
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map(company => (
              <CompanyCard
                key={company.company_id}
                company={company}
                techs={techs}
                categoryLabelMap={categoryLabelMap}
                selectedTechs={selectedTechs}
                onClick={goToJobs}
              />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
