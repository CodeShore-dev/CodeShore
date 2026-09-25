import { type KeyboardEvent, useId } from 'react';
import { MAX_PREFERENCE_REASON_LENGTH } from '@codeshore/shared-utils';

export type ReasonAddError = 'empty' | 'too_long';

export interface JobPreferenceReasonAddInputProps {
  value: string;
  error: ReasonAddError | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

const ERROR_TEXT = {
  empty: '請輸入名稱',
  too_long: `最多 ${MAX_PREFERENCE_REASON_LENGTH} 個字`,
} as const;

// Controlled text input for adding a new reason in the picker dialog. The
// dialog owns the typed text, because its footer button turns from 確認 into
// 新增 while the input has text. Enter submits the same way as that button.
export function JobPreferenceReasonAddInput({
  value,
  error,
  onChange,
  onSubmit,
}: JobPreferenceReasonAddInputProps) {
  const errorId = useId();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }
    // Keep Enter from submitting an outer form or reaching the dialog.
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        aria-label="新增子分類"
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        placeholder="輸入新的子分類，按 Enter 直接送出"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-[#c3c6d5] bg-white px-3 py-2 text-sm text-[#001f2a] placeholder:text-[#434653]/60 focus:border-[#003d92] focus:outline-none"
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[#ba1a1a]">
          {ERROR_TEXT[error]}
        </p>
      )}
    </div>
  );
}
