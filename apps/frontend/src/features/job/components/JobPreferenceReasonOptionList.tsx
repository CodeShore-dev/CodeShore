import { formatNumber } from '../../../utils/format';
import type { ReasonOption } from '../buildReasonOptions';

export interface JobPreferenceReasonOptionListProps {
  options: ReasonOption[];
  selected: string;
  onSelect: (reason: string) => void;
  onDelete: (option: ReasonOption) => void;
}

// Presentational single-select list for the reason picker dialog. Each row
// shows the reason name and how many jobs use it (3.2). Only deletable
// options get a delete button, so the default reason never does (5.1, 5.6).
// The delete button sits outside the row's <label>, so pressing it never
// changes the selection.
export function JobPreferenceReasonOptionList({
  options,
  selected,
  onSelect,
  onDelete,
}: JobPreferenceReasonOptionListProps) {
  return (
    <ul
      role="radiogroup"
      aria-label="子分類"
      className="divide-y divide-[#001f2a]/[0.06] rounded-lg border border-[#c3c6d5] bg-white"
    >
      {options.map((option) => {
        const isSelected = option.reason === selected;
        return (
          <li
            key={option.reason}
            className={`flex items-center gap-2 px-3 py-2 ${
              isSelected ? 'bg-[#d9f2ff]' : 'hover:bg-[#f4faff]'
            }`}
          >
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="job-preference-reason"
                value={option.reason}
                aria-label={option.reason}
                checked={isSelected}
                onChange={() => onSelect(option.reason)}
                className="h-4 w-4 shrink-0 accent-[#003d92]"
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  isSelected ? 'font-bold text-[#003d92]' : 'text-[#001f2a]'
                }`}
              >
                {option.reason}
              </span>
              <span
                data-testid={`reason-count-${option.reason}`}
                className="shrink-0 text-xs tabular-nums text-[#434653]"
              >
                {formatNumber(option.jobCount)}
              </span>
            </label>
            {option.deletable && (
              <button
                type="button"
                aria-label={`刪除「${option.reason}」`}
                onClick={() => onDelete(option)}
                className="shrink-0 rounded px-2 py-1 text-xs text-[#434653] hover:bg-[#ba1a1a]/[0.08] hover:text-[#ba1a1a]"
              >
                刪除
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
