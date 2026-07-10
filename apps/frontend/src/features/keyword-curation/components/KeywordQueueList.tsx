import { useCurationStore } from '../curationStore';
import { useKeywordQueueQuery } from '../queries';
import type { QueuedKeyword } from '../service';
import { formatNumber } from '../../../utils/format';

interface KeywordQueueListProps {
  onSelectKeyword: (keyword: string) => void;
}

// Unmapped keyword sidebar (task 6.1, requirements 1.1-1.3, 2.3). Fetches its
// own data via useKeywordQueueQuery() and reads session-in-progress state
// directly from curationStore, so callers only need to supply
// onSelectKeyword -- the actual session-starting mutation (useStartSession
// Mutation) is wired one level up in task 7.1's page component; this
// component stays presentational and just reports selection intent.
export function KeywordQueueList({ onSelectKeyword }: KeywordQueueListProps) {
  const { data, isLoading } = useKeywordQueueQuery();
  const sessionStatus = useCurationStore(s => s.sessionStatus);

  // The backend's getQueue() (task 4.1) already returns keywords sorted by
  // count desc, but this list re-sorts defensively client-side: it's O(n log n)
  // over a small admin-facing list, guards requirement 1.1's ordering
  // guarantee against a future regression in the API contract, and costs
  // nothing observable at this scale.
  const keywords = [...(data?.keywords ?? [])].sort((a, b) => b.count - a.count);

  // Requirement 2.3: while a session is loading (AI analysis running) or
  // interrupted (awaiting a human decision), an active session already
  // exists, so every keyword card -- including the currently active one --
  // is disabled to prevent re-triggering analysis for the same keyword or
  // starting a second concurrent session.
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
    <ul className="flex flex-col gap-2 p-4">
      {keywords.map(keyword => (
        <KeywordQueueCard
          key={keyword.id}
          keyword={keyword}
          disabled={sessionInProgress}
          onSelectKeyword={onSelectKeyword}
        />
      ))}
    </ul>
  );
}

interface KeywordQueueCardProps {
  keyword: QueuedKeyword;
  disabled: boolean;
  onSelectKeyword: (keyword: string) => void;
}

function KeywordQueueCard({
  keyword,
  disabled,
  onSelectKeyword,
}: KeywordQueueCardProps) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelectKeyword(keyword.id)}
        className={`w-full rounded-xl border border-[#c3c6d5] bg-white px-4 py-3 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition ${
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:bg-[#f4faff]'
        }`}
      >
        <div className="font-mono text-sm font-bold text-[#001f2a]">
          {keyword.id}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-[#434653]">
          <span className="tabular-nums">
            {formatNumber(keyword.count)} 次出現
          </span>
          <span className="tabular-nums">
            {formatNumber(keyword.affectedJobCount)} 個職缺
          </span>
        </div>
      </button>
    </li>
  );
}
