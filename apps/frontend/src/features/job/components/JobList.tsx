import { useEffect, useRef } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { Pagination } from '../../../components/Pagination';
import { usePreferenceMutation } from '../mutations';
import { JOB_PAGE_SIZE } from '../queries';
import { JobDetailDrawer } from './JobDetailDrawer';
import { JobListItem } from './JobListItem';
import { JobListSkeleton } from './JobListSkeleton';

interface JobListProps {
  jobs: SupabaseView.MvJob[];
  count: number;
  page: number;
  loading: boolean;
  fetching: boolean;
  listViewPreference: 'like' | 'dislike' | null;
  selectedJobId: string | null;
  hasActiveFilters: boolean;
  onSelectJob: (jobId: string | null) => void;
  onPageChange: (page: number) => void;
  onClearAllFilters: () => void;
  // Guest preference gate (requirement 2): wraps every like/dislike mutation
  // call site so an unauthenticated visitor sees the login prompt instead of
  // the mutation silently running. A no-op passthrough for authenticated
  // users -- see useGuestPreferenceGate.requestPreference.
  onGuardPreference: (action: () => void) => void;
}

// Job list + pagination + detail drawer orchestration (task 7.5),
// ported from JobList.vue. Server data arrives via props (TanStack Query);
// the optimistic like/dislike mutation lives here so the list item buttons
// and the drawer share one instance.
export function JobList({
  jobs,
  count,
  page,
  loading,
  fetching,
  listViewPreference,
  selectedJobId,
  hasActiveFilters,
  onSelectJob,
  onPageChange,
  onClearAllFilters,
  onGuardPreference,
}: JobListProps) {
  const preferenceMutation = usePreferenceMutation();
  const totalPages = Math.ceil(count / JOB_PAGE_SIZE);

  const selectedJob = jobs.find(x => x.id === selectedJobId);
  const selectedJobIndex = jobs.findIndex(x => x.id === selectedJobId);
  const isFirstJobOnFirstPage = selectedJobIndex === 0 && page === 1;
  const isLastJobOnLastPage =
    selectedJobIndex === jobs.length - 1 && page >= totalPages;

  // Cross-page drawer navigation: when we step past the current page, remember
  // which end of the next page to land on, then apply it once it loads.
  const pendingSelect = useRef<'first' | 'last' | null>(null);
  useEffect(() => {
    if (!pendingSelect.current || fetching || jobs.length === 0) return;
    const target =
      pendingSelect.current === 'first'
        ? jobs[0]?.id
        : jobs[jobs.length - 1]?.id;
    pendingSelect.current = null;
    onSelectJob(target ?? null);
  }, [jobs, fetching, onSelectJob]);

  const goToPrevJob = () => {
    if (isFirstJobOnFirstPage || fetching) return;
    if (selectedJobIndex > 0) {
      onSelectJob(jobs[selectedJobIndex - 1].id);
    } else {
      pendingSelect.current = 'last';
      onPageChange(page - 1);
    }
  };

  const goToNextJob = () => {
    if (isLastJobOnLastPage || fetching) return;
    if (selectedJobIndex < jobs.length - 1) {
      onSelectJob(jobs[selectedJobIndex + 1].id);
    } else {
      pendingSelect.current = 'first';
      onPageChange(page + 1);
    }
  };

  const updatePreference = (preference: 'like' | 'dislike') => {
    if (preferenceMutation.isPending || !selectedJob) return;
    const currentId = selectedJob.id;
    const currentIndex = selectedJobIndex;
    const nextJob =
      jobs[currentIndex + 1] ?? jobs[currentIndex - 1] ?? null;
    onGuardPreference(() => {
      onSelectJob(nextJob?.id ?? null);
      preferenceMutation.mutate({ id: currentId, preference });
    });
  };

  const onPreference = (id: string, preference: 'like' | 'dislike') => {
    onGuardPreference(() => {
      preferenceMutation.mutate({ id, preference });
    });
  };

  // Keep the selected row visible as the drawer steps through jobs.
  const itemElMap = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (selectedJobId) {
      itemElMap.current
        .get(selectedJobId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedJobId]);

  return (
    <>
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
        {loading ? (
          <JobListSkeleton />
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <span className="material-symbols-outlined mb-4 text-6xl text-[#001f2a]/20">
              search_off
            </span>
            <h2 className="mb-2 text-xl font-black text-[#001f2a]">
              此篩選條件沒有職缺
            </h2>
            <p className="mb-6 text-sm text-[#434653]">
              試試切換別的篩選組合或清空篩選條件，以探索更多機會。
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="cursor-pointer rounded-xl bg-[#003d92] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1654b9] active:scale-95"
                onClick={onClearAllFilters}
              >
                清空所有篩選
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-[#001f2a]/[0.06] pl-0">
              {jobs.map(job => (
                <JobListItem
                  key={job.id}
                  innerRef={el => {
                    if (el) itemElMap.current.set(job.id, el);
                    else itemElMap.current.delete(job.id);
                  }}
                  job={job}
                  selected={selectedJobId === job.id}
                  listViewPreference={listViewPreference}
                  disabled={fetching}
                  onSelect={onSelectJob}
                  onPreference={onPreference}
                />
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="border-t border-[#001f2a]/[0.06] px-5 py-3">
                <span className="mb-2 block text-xs font-bold text-[#434653]">
                  第 {page} / {totalPages} 頁・共 {count} 筆
                </span>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      <JobDetailDrawer
        job={selectedJob}
        isFirst={isFirstJobOnFirstPage}
        isLast={isLastJobOnLastPage}
        loading={loading}
        preferenceUpdating={preferenceMutation.isPending}
        listViewPreference={listViewPreference}
        onClose={() => onSelectJob(null)}
        onPrev={goToPrevJob}
        onNext={goToNextJob}
        onUpdatePreference={updatePreference}
      />
    </>
  );
}
