import { type KeyboardEvent, useId, useState } from 'react';
import {
  MAX_PREFERENCE_REASON_LENGTH,
  normalizeReason,
} from '@codeshore/shared-utils';

export interface JobPreferenceReasonAddInputProps {
  onAdd: (reason: string) => void;
}

const ERROR_TEXT = {
  empty: '請輸入名稱',
  too_long: `最多 ${MAX_PREFERENCE_REASON_LENGTH} 個字`,
} as const;

// Text input for adding a new reason in the picker dialog. The name is
// trimmed and validated with the shared rule (4.2); invalid names show a hint
// and never reach onAdd (4.3, 4.4). A valid name is handed to the parent,
// which confirms the mark with it right away (4.1, 4.5).
export function JobPreferenceReasonAddInput({
  onAdd,
}: JobPreferenceReasonAddInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<keyof typeof ERROR_TEXT | null>(null);
  const errorId = useId();

  const submit = () => {
    const result = normalizeReason(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAdd(result.value);
    setValue('');
    setError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }
    // Keep Enter from submitting an outer form or reaching the dialog.
    event.preventDefault();
    event.stopPropagation();
    submit();
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          aria-label="新增子分類"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          placeholder="輸入新的子分類，按 Enter 直接送出"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded-lg border border-[#c3c6d5] bg-white px-3 py-2 text-sm text-[#001f2a] placeholder:text-[#434653]/60 focus:border-[#003d92] focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          className="shrink-0 cursor-pointer rounded-lg border border-[#003d92] bg-white px-3 py-2 text-sm font-bold text-[#003d92] transition-colors hover:bg-[#f4faff]"
        >
          新增
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[#ba1a1a]">
          {ERROR_TEXT[error]}
        </p>
      )}
    </div>
  );
}
