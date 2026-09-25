import { type KeyboardEvent, useId, useState } from 'react';
import { MAX_PREFERENCE_REASON_LENGTH } from '@codeshore/shared-utils';

import type { RenameError } from '../hooks/useReasonRename';

export interface JobPreferenceReasonRenameInputProps {
  initial: string;
  error: RenameError | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}

const ERROR_TEXT: Record<RenameError, string> = {
  empty: '請輸入名稱',
  too_long: `最多 ${MAX_PREFERENCE_REASON_LENGTH} 個字`,
  duplicate: '已有同名分類',
  failed: '改名失敗',
};

// In-place rename field that replaces a reason chip (9.2). It only collects
// the raw text; the dialog validates it and reports back through `error`
// (9.4, 9.5, 9.9). Esc is handled by the dialog, which cancels only the
// rename (9.10).
export function JobPreferenceReasonRenameInput({
  initial,
  error,
  onSave,
  onCancel,
}: JobPreferenceReasonRenameInputProps) {
  const [value, setValue] = useState(initial);
  const errorId = useId();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    // Keep Enter from submitting an outer form or reaching the dialog.
    event.preventDefault();
    event.stopPropagation();
    onSave(value);
  };

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          aria-label="新名稱"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded-full border border-[#003d92] bg-white px-3.5 py-1.5 text-sm text-[#001f2a] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSave(value)}
          className="shrink-0 cursor-pointer rounded-full bg-[#003d92] px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-[#1654b9]"
        >
          儲存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-sm font-bold text-[#434653] transition-colors hover:bg-[#f4faff]"
        >
          取消
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
