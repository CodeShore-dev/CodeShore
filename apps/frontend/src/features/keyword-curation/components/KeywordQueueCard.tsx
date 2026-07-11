import { useQueueStore } from '../queueStore';
import type { QueuedKeyword } from '../service';
import { formatNumber } from '../../../utils/format';

interface KeywordQueueCardProps {
  keyword: QueuedKeyword;
  disabled: boolean;
  onSelectKeyword: (keyword: string) => void;
}

// Single queue row (extracted from KeywordQueueList.tsx to stay under
// frontend-standards.md's 200-line-per-file limit once bulk-select checkbox
// support was added). While `useQueueStore`'s `selectMode` is on, the row
// renders a checkbox and clicking anywhere toggles selection instead of
// starting a curation session; otherwise it behaves as before (starts a
// session, disabled while another session is in progress).
export function KeywordQueueCard({
  keyword,
  disabled,
  onSelectKeyword,
}: KeywordQueueCardProps) {
  const selectMode = useQueueStore(s => s.selectMode);
  const selected = useQueueStore(s => s.selectedIds.has(keyword.id));
  const toggleSelectId = useQueueStore(s => s.toggleSelectId);

  const handleClick = (): void => {
    if (selectMode) toggleSelectId(keyword.id);
    else onSelectKeyword(keyword.id);
  };

  return (
    <li className='block'>
      <button
        type="button"
        disabled={!selectMode && disabled}
        onClick={handleClick}
        className={`flex w-full items-center gap-3 rounded-xl border border-[#c3c6d5] bg-white px-4 py-3 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition ${
          !selectMode && disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:bg-[#f4faff]'
        }`}
      >
        {selectMode && (
          <span
            data-testid="keyword-queue-card-checkbox"
            className={`flex size-4 shrink-0 items-center justify-center rounded border-2 transition ${
              selected ? 'border-[#003d92] bg-[#003d92]' : 'border-[#c3c6d5]'
            }`}
          >
            {selected && (
              <span className="material-symbols-outlined text-sm text-white">
                check
              </span>
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-bold text-[#001f2a]">
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
        </div>
      </button>
    </li>
  );
}
