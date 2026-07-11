import { Pagination } from '../../../components/Pagination';
import { useCurationStore } from '../curationStore';
import { QUEUE_PAGE_SIZE } from '../service';
import { useKeywordQueueQuery } from '../queries';
import { useQueueStore } from '../queueStore';
import { KeywordQueueCard } from './KeywordQueueCard';

interface KeywordQueueListProps {
  onSelectKeyword: (keyword: string) => void;
}

// Unmapped keyword sidebar (task 6.1, requirements 1.1-1.3, 2.3; paginated
// 10/page + bulk-select checkboxes added later). Fetches its own data via
// useKeywordQueueQuery(page) and reads session-in-progress/pagination/
// select-mode state directly from curationStore/queueStore, so callers only
// need to supply onSelectKeyword -- the actual session-starting mutation
// (useStartSessionMutation) is wired one level up in the page component;
// this component stays presentational and just reports selection intent.
export function KeywordQueueList({ onSelectKeyword }: KeywordQueueListProps) {
  const currentPage = useQueueStore(s => s.currentPage);
  const setPage = useQueueStore(s => s.setPage);
  const { data, isLoading } = useKeywordQueueQuery(currentPage);
  const sessionStatus = useCurationStore(s => s.sessionStatus);

  // The backend's getQueue() (task 4.1) already returns keywords sorted by
  // count desc, but this list re-sorts defensively client-side: it's O(n log n)
  // over a small admin-facing page, guards requirement 1.1's ordering
  // guarantee against a future regression in the API contract, and costs
  // nothing observable at this scale.
  const keywords = [...(data?.keywords ?? [])].sort((a, b) => b.count - a.count);
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / QUEUE_PAGE_SIZE));

  // Requirement 2.3: while a session is loading (AI analysis running) or
  // interrupted (awaiting a human decision), an active session already
  // exists, so every keyword card -- including the currently active one --
  // is disabled to prevent re-triggering analysis for the same keyword or
  // starting a second concurrent session. (KeywordQueueCard ignores this
  // while bulk-select mode is on, since clicking selects rather than starts
  // a session in that mode.)
  const sessionInProgress =
    sessionStatus === 'loading' || sessionStatus === 'interrupted';

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-[#001f2a]/[0.08]"
          />
        ))}
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <span className="material-symbols-outlined mb-4 text-6xl text-[#001f2a]/20">
          task_alt
        </span>
        <h2 className="mb-2 text-xl font-black text-[#001f2a]">
          所有合格 keyword 均已處理完畢
        </h2>
        <p className="text-sm text-[#434653]">目前沒有待策展的 keyword。</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ul className="flex flex-col gap-2 p-0">
        {keywords.map(keyword => (
          <KeywordQueueCard
            key={keyword.id}
            keyword={keyword}
            disabled={sessionInProgress}
            onSelectKeyword={onSelectKeyword}
          />
        ))}
      </ul>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
