import { formatNumber } from '../../../utils/format';
import type { ReasonOption } from '../buildReasonOptions';

export interface JobPreferenceReasonOptionListProps {
  options: ReasonOption[];
  selected: string;
  onSelect: (reason: string) => void;
  onDelete: (option: ReasonOption) => void;
}

// Single-select chips for the reason picker dialog. Each chip shows the
// reason name and how many jobs use it (3.2). Only deletable options get a
// visible ✕ delete button, so the default reason never does (5.1, 5.6). The
// ✕ is a sibling of the select button, so pressing it never changes the
// selection.
export function JobPreferenceReasonOptionList({
  options,
  selected,
  onSelect,
  onDelete,
}: JobPreferenceReasonOptionListProps) {
  return (
    <div role="radiogroup" aria-label="子分類" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option.reason === selected;
        return (
          <div
            key={option.reason}
            className={`inline-flex max-w-full items-center rounded-full transition-colors ${
              isSelected
                ? 'bg-[#003d92] text-white'
                : 'bg-[#c9e7f7] text-[#001f2a] hover:bg-[#d9f2ff]'
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={option.reason}
              onClick={() => onSelect(option.reason)}
              className={`inline-flex min-w-0 cursor-pointer items-center gap-1.5 py-1.5 text-sm font-bold ${
                option.deletable ? 'pr-1 pl-3.5' : 'px-3.5'
              }`}
            >
              <span className="truncate">{option.reason}</span>
              <span
                data-testid={`reason-count-${option.reason}`}
                className={`text-xs font-bold tabular-nums ${
                  isSelected ? 'text-white/75' : 'text-[#434653]'
                }`}
              >
                {formatNumber(option.jobCount)}
              </span>
            </button>
            {option.deletable && (
              <button
                type="button"
                aria-label={`刪除「${option.reason}」`}
                onClick={() => onDelete(option)}
                className={`mr-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
                  isSelected
                    ? 'text-white hover:bg-white/20'
                    : 'text-[#434653] hover:bg-[#ba1a1a] hover:text-white'
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px' }}
                  aria-hidden="true"
                >
                  close
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
