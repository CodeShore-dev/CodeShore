import { useEffect, useState } from 'react';

import { useUpdateLlmSettingsMutation } from '../mutations';
import { useLlmSettingsQuery } from '../queries';

// Backend-adjustable default LLM model control ("後台可以調整預設值"): shows
// the current `GET /ai-suggestion/llm-settings` default and lets an admin
// change it via `PATCH /ai-suggestion/llm-settings`. Extracted out of
// `AiSuggestionReviewPage` to keep it under this repo's 200-line `max-lines`
// limit -- same rationale as `SuggestionFilterBar`/`SuggestionDateRangeFilter`.
export function LlmSettingsPanel() {
  const settingsQuery = useLlmSettingsQuery();
  const updateMutation = useUpdateLlmSettingsMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (settingsQuery.data && !editing) {
      setDraft(settingsQuery.data.defaultModel);
    }
  }, [settingsQuery.data, editing]);

  const handleSave = () => {
    if (!draft.trim()) return;
    updateMutation.mutate(draft.trim(), {
      onSuccess: () => setEditing(false),
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-on-surface-variant font-semibold">預設模型</span>
      {editing ? (
        <>
          <input
            type="text"
            value={draft}
            data-testid="llm-default-model-input"
            className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 px-2 text-sm"
            onChange={e => setDraft(e.target.value)}
          />
          <button
            type="button"
            data-testid="llm-default-model-save"
            className="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={updateMutation.isPending}
            onClick={handleSave}
          >
            儲存
          </button>
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface cursor-pointer text-sm"
            onClick={() => {
              setEditing(false);
              setDraft(settingsQuery.data?.defaultModel ?? '');
            }}
          >
            取消
          </button>
        </>
      ) : (
        <>
          <span
            data-testid="llm-default-model-value"
            className="text-on-surface"
          >
            {settingsQuery.data?.defaultModel ?? '載入中…'}
          </span>
          <button
            type="button"
            data-testid="llm-default-model-edit"
            className="text-primary hover:underline cursor-pointer text-sm"
            onClick={() => setEditing(true)}
          >
            編輯
          </button>
        </>
      )}
    </div>
  );
}
