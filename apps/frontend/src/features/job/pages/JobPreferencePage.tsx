import { useState } from 'react';

import { formatNumber } from '../../../utils/format';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useHomeData } from '../../home/hooks/useHomeData';
import { InfoHint } from '../../methodology/components/InfoHint';
import { JobActiveFilters } from '../components/JobActiveFilters';
import { JobFilterSidebar } from '../components/JobFilterSidebar';
import { JobList } from '../components/JobList';
import { deriveJobWhere } from '../deriveJobWhere';
import { useJobUrlSync } from '../hooks/useJobUrlSync';
import { useJobFilterStore } from '../jobFilterStore';
import { useClearPreferencesMutation } from '../mutations';
import { jobListOrders, useJobsQuery, usePreferencedCountQuery } from '../queries';

const SORT_OPTIONS = [
  { value: 'salary', label: '薪資' },
  { value: 'recent', label: '最近標記' },
] as const;

// Job preference page: filtering, like/dislike marking, pagination, detail
// drawer, crawl, and original-platform handoff (task 7.5). Wires the job +
// keyword filter stores, the job/count queries, the preference mutation, URL
// sync, and crawl stream that the earlier sub-tasks built.
export function JobPreferencePage() {
  useJobUrlSync();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Job filter state.
  const page = useJobFilterStore(s => s.page);
  const setPage = useJobFilterStore(s => s.setPage);
  const sort = useJobFilterStore(s => s.sort);
  const setSort = useJobFilterStore(s => s.setSort);
  const listViewPreference = useJobFilterStore(s => s.listViewPreference);
  const setListViewPreference = useJobFilterStore(s => s.setListViewPreference);
  const selectedJobId = useJobFilterStore(s => s.selectedJobId);
  const setSelectedJobId = useJobFilterStore(s => s.setSelectedJobId);
  const searchText = useJobFilterStore(s => s.searchText);
  const companySearchText = useJobFilterStore(s => s.companySearchText);
  const salaryFilter = useJobFilterStore(s => s.salaryFilter);
  const salaryAmount = useJobFilterStore(s => s.salaryAmount);
  const selectedLocations = useJobFilterStore(s => s.selectedLocations);
  const setSearchText = useJobFilterStore(s => s.setSearchText);
  const setCompanySearchText = useJobFilterStore(s => s.setCompanySearchText);
  const setSalaryFilter = useJobFilterStore(s => s.setSalaryFilter);
  const setSalaryAmount = useJobFilterStore(s => s.setSalaryAmount);
  const setSelectedLocations = useJobFilterStore(s => s.setSelectedLocations);

  // Keyword filter state.
  const selectedTags = useKeywordFilterStore(s => s.selectedTags);
  const excludedTags = useKeywordFilterStore(s => s.excludedTags);
  const keywordOperator = useKeywordFilterStore(s => s.keywordOperator);
  const setSelectedTags = useKeywordFilterStore(s => s.setSelectedTags);
  const setExcludedTags = useKeywordFilterStore(s => s.setExcludedTags);
  const setOperator = useKeywordFilterStore(s => s.setOperator);
  const setKeywordSearch = useKeywordFilterStore(s => s.setKeywordSearch);
  const setSelectedTab = useKeywordFilterStore(s => s.setSelectedTab);

  const where = deriveJobWhere({
    searchText,
    companySearchText,
    salaryFilter,
    salaryAmount,
    selectedLocations,
    selectedTags,
    excludedTags,
    keywordOperator,
  });
  const orders = jobListOrders(listViewPreference, sort);

  const jobsQuery = useJobsQuery({
    preference: listViewPreference,
    page,
    where,
    orders,
  });
  const countQuery = usePreferencedCountQuery();
  const clearPreferences = useClearPreferencesMutation();
  const { openJobs } = useHomeData();

  const liked = countQuery.data?.liked_count ?? 0;
  const disliked = countQuery.data?.disliked_count ?? 0;
  const countText = {
    total: formatNumber(openJobs - liked - disliked),
    liked: formatNumber(liked),
    disliked: formatNumber(disliked),
  };

  const jobs = jobsQuery.data?.result ?? [];
  const count = jobsQuery.data?.count ?? 0;
  const loading = jobsQuery.isLoading;
  const listTotalCountText = formatNumber(count);

  const viewTabs = [
    {
      label: '總數',
      pref: null as 'like' | 'dislike' | null,
      count: countText.total,
      onClick: () => setListViewPreference(null),
      onClear: null as null | (() => void),
    },
    {
      label: '喜歡',
      pref: 'like' as const,
      count: countText.liked,
      onClick: () => setListViewPreference('like'),
      onClear: () => clearPreferences.mutate('like'),
    },
    {
      label: '不喜歡',
      pref: 'dislike' as const,
      count: countText.disliked,
      onClick: () => setListViewPreference('dislike'),
      onClear: () => clearPreferences.mutate('dislike'),
    },
  ];

  const hasActiveFilters =
    selectedTags.length > 0 ||
    excludedTags.length > 0 ||
    keywordOperator !== 'and' ||
    salaryFilter !== 'none' ||
    salaryAmount.type !== '' ||
    salaryAmount.amount !== null ||
    !!searchText ||
    !!companySearchText ||
    selectedLocations.length > 0;

  const clearAllFilters = () => {
    setSelectedTags([]);
    setExcludedTags([]);
    setOperator('and');
    setKeywordSearch('');
    setSelectedTab(null);
    setSalaryFilter('none');
    setSalaryAmount({ type: '', amount: null });
    setSearchText('');
    setCompanySearchText('');
    setSelectedLocations([]);
  };

  return (
    <div className="flex w-full flex-1 gap-4 overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`z-51 flex max-h-screen min-w-70 flex-col space-y-8 overflow-y-auto rounded-xl bg-white px-6 py-8 shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-transform duration-300 lg:z-40 lg:max-h-full ${
          isSidebarOpen
            ? 'fixed inset-y-0 left-0 h-full w-80 translate-x-0 shadow-2xl'
            : 'fixed inset-y-0 left-0 h-full w-80 -translate-x-full lg:static lg:flex lg:h-auto lg:w-72 lg:translate-x-0'
        }`}
      >
        <div>
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <h3 className="text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
              篩選條件
            </h3>
            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  className="cursor-pointer text-sm font-bold text-[#003d92]"
                  onClick={clearAllFilters}
                >
                  清除篩選
                </button>
              )}
              <button
                type="button"
                className="cursor-pointer text-[#434653] hover:text-[#001f2a]"
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>
          <div className="mb-2 hidden items-center justify-between lg:flex">
            <h3 className="mb-0 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
              篩選條件
            </h3>
            {hasActiveFilters && (
              <button
                type="button"
                className="cursor-pointer text-sm font-bold text-[#003d92]"
                onClick={clearAllFilters}
              >
                清除篩選
              </button>
            )}
          </div>
          <JobFilterSidebar />
        </div>
      </aside>

      <div className="w-full overflow-hidden">
        <button
          type="button"
          className="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white p-4 font-bold text-[#001f2a] shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:bg-[#f4faff] active:scale-[0.98] lg:hidden"
          onClick={() => setIsSidebarOpen(true)}
        >
          <span className="material-symbols-outlined">tune</span>
          篩選條件
          {hasActiveFilters && (
            <span className="ml-auto rounded-full bg-[#003d92] px-2 py-0.5 text-xs font-bold text-white">
              已篩選
            </span>
          )}
        </button>

        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          職缺統計
          <InfoHint metric="job.list" />
        </div>
        <section className="mb-6 grid w-full max-w-lg grid-cols-3 gap-3">
          {viewTabs.map(tab => (
            <div
              key={tab.pref ?? 'all'}
              className={`relative rounded-xl transition-all ${
                listViewPreference === tab.pref
                  ? 'bg-[#003d92] text-white shadow-md'
                  : 'bg-white text-[#001f2a] shadow-[0_24px_40px_rgba(0,31,42,0.06)]'
              }`}
            >
              <button
                type="button"
                className={`h-full w-full p-4 text-center active:scale-95 ${
                  listViewPreference !== tab.pref
                    ? 'cursor-pointer rounded-xl hover:bg-[#f4faff]'
                    : ''
                }`}
                onClick={tab.onClick}
              >
                <span
                  className={`mb-1 block text-[10px] font-bold tracking-[0.15em] ${
                    listViewPreference === tab.pref
                      ? 'text-white/60'
                      : 'text-[#434653]'
                  }`}
                >
                  {tab.label}
                </span>
                <span className="text-2xl font-black tabular-nums">
                  {listViewPreference === tab.pref && !loading
                    ? listTotalCountText
                    : tab.count}
                  {listViewPreference === tab.pref && (
                    <span className="text-sm whitespace-nowrap">
                      {' '}
                      / {tab.count}
                    </span>
                  )}
                </span>
              </button>
              {tab.onClear && tab.count !== '0' && (
                <button
                  type="button"
                  className={`absolute top-1.5 right-1.5 flex size-6 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                    listViewPreference === tab.pref
                      ? 'text-white/50 hover:bg-white/20 hover:text-white'
                      : 'text-[#999] hover:bg-[#fee2e2] hover:text-[#dc2626]'
                  }`}
                  title={`清空${tab.label}`}
                  onClick={e => {
                    e.stopPropagation();
                    tab.onClear?.();
                  }}
                >
                  <span className="material-symbols-outlined text-base leading-none">
                    delete
                  </span>
                </button>
              )}
            </div>
          ))}
        </section>

        <JobActiveFilters onClearAll={clearAllFilters} />

        {listViewPreference && (
          <div className="mb-4 flex items-center justify-end gap-2">
            <span className="text-xs font-bold text-[#434653]">排序</span>
            <div className="inline-flex rounded-xl bg-white p-1 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
              {SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                    sort === option.value
                      ? 'bg-[#003d92] text-white shadow-md'
                      : 'text-[#001f2a] hover:bg-[#f4faff]'
                  }`}
                  onClick={() => setSort(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <JobList
          jobs={jobs}
          count={count}
          page={page}
          loading={loading}
          fetching={jobsQuery.isFetching}
          listViewPreference={listViewPreference}
          selectedJobId={selectedJobId}
          hasActiveFilters={hasActiveFilters}
          onSelectJob={setSelectedJobId}
          onPageChange={setPage}
          onClearAllFilters={clearAllFilters}
        />
      </div>
    </div>
  );
}
