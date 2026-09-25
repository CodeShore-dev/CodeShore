import { formatNumber } from '../../../utils/format';
import type { ReasonOption } from '../buildReasonOptions';
import type { RenameError } from '../hooks/useReasonRename';
import { JobPreferenceReasonRenameInput } from './JobPreferenceReasonRenameInput';

export interface JobPreferenceReasonOptionListProps {
  options: ReasonOption[];
  selected: string;
  onSelect: (reason: string) => void;
  onDelete: (option: ReasonOption) => void;
  renaming: string | null;
  renameError: RenameError | null;
  onStartRename: (reason: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onCancelRename: () => void;
}

function ChipIconButton({
  label,
  icon,
  isSelected,
  hoverClass,
  className = '',
  onClick,
}: {
  label: string;
  icon: string;
  isSelected: boolean;
  hoverClass: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${className} ${
        isSelected ? 'text-white hover:bg-white/20' : `text-[#434653] ${hoverClass}`
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

// Single-select chips for the reason picker dialog. Each chip shows the
// reason name and how many jobs use it (3.2). Only deletable options get a
// visible ✕ delete button, so the default reason never does (5.1, 5.6). The
// ✕ is a sibling of the select button, so pressing it never changes the
// selection. Server-side deletable options also get a ✎ rename button (9.1);
// the chip being renamed is replaced by an in-place input (9.2).
export function JobPreferenceReasonOptionList({
  options,
  selected,
  onSelect,
  onDelete,
  renaming,
  renameError,
  onStartRename,
  onRename,
  onCancelRename,
}: JobPreferenceReasonOptionListProps) {
  return (
    <div role="radiogroup" aria-label="子分類" className="flex flex-wrap gap-2">
      {options.map((option) => {
        if (option.reason === renaming) {
          return (
            <JobPreferenceReasonRenameInput
              key={option.reason}
              initial={option.reason}
              error={renameError}
              onSave={(name) => onRename(option.reason, name)}
              onCancel={onCancelRename}
            />
          );
        }
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
            {option.deletable && !option.isDraft && (
              <ChipIconButton
                label={`改名「${option.reason}」`}
                icon="edit"
                isSelected={isSelected}
                hoverClass="hover:bg-[#003d92] hover:text-white"
                onClick={() => onStartRename(option.reason)}
              />
            )}
            {option.deletable && (
              <ChipIconButton
                label={`刪除「${option.reason}」`}
                icon="close"
                isSelected={isSelected}
                className="mr-1"
                hoverClass="hover:bg-[#ba1a1a] hover:text-white"
                onClick={() => onDelete(option)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
