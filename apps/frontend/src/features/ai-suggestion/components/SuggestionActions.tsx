import { useState } from 'react';

import { AiSuggestionRecord } from '../service';

interface SuggestionActionsProps {
  suggestion: AiSuggestionRecord;
  onApprove: (id: string, editedPayload?: Record<string, unknown>) => void;
  onReject: (id: string, note?: string) => void;
  approving: boolean;
  rejecting: boolean;
}

// Approve/reject action panel for a pending suggestion (requirement 7.3,
// 7.4), split out of `SuggestionCard` to keep each file under this repo's
// `max-lines` lint limit. Approve optionally opens a JSON textarea
// pre-filled with the suggested payload so the reviewer can edit it before
// confirming -- the edited content, not the original, is what actually
// lands.
export function SuggestionActions({
  suggestion,
  onApprove,
  onReject,
  approving,
  rejecting,
}: SuggestionActionsProps) {
  const [editingPayload, setEditingPayload] = useState(false);
  const [payloadDraft, setPayloadDraft] = useState(() =>
    JSON.stringify(suggestion.payload, null, 2),
  );
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [rejectingUi, setRejectingUi] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const startEditPayload = () => {
    setPayloadDraft(JSON.stringify(suggestion.payload, null, 2));
    setPayloadError(null);
    setEditingPayload(true);
  };

  const confirmApprove = (editedPayload?: Record<string, unknown>) => {
    onApprove(suggestion.id, editedPayload);
    setEditingPayload(false);
  };

  const submitEditedPayload = () => {
    try {
      const parsed = JSON.parse(payloadDraft) as Record<string, unknown>;
      setPayloadError(null);
      confirmApprove(parsed);
    } catch {
      setPayloadError('JSON 格式錯誤，請確認格式後再試一次');
    }
  };

  const submitReject = () => {
    onReject(suggestion.id, noteDraft.trim() || undefined);
    setRejectingUi(false);
    setNoteDraft('');
  };

  if (editingPayload) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <label className="text-on-surface-variant text-xs font-semibold">
          核准前修改內容（JSON）
        </label>
        <textarea
          value={payloadDraft}
          data-testid={`payload-editor-${suggestion.id}`}
          className="border-surface-container bg-surface-container-lowest text-on-surface min-h-32 rounded-lg border p-2 font-mono text-xs"
          onChange={e => setPayloadDraft(e.target.value)}
        />
        {payloadError && <p className="text-error text-xs">{payloadError}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            data-testid={`confirm-approve-${suggestion.id}`}
            className="bg-primary text-on-primary cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={approving}
            onClick={submitEditedPayload}
          >
            確認核准
          </button>
          <button
            type="button"
            className="border-surface-container text-on-surface-variant cursor-pointer rounded-lg border px-3 py-1.5 text-xs"
            onClick={() => setEditingPayload(false)}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  if (rejectingUi) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <label className="text-on-surface-variant text-xs font-semibold">
          駁回原因（選填）
        </label>
        <textarea
          value={noteDraft}
          className="border-surface-container bg-surface-container-lowest text-on-surface min-h-16 rounded-lg border p-2 text-xs"
          onChange={e => setNoteDraft(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            data-testid={`confirm-reject-${suggestion.id}`}
            className="bg-error text-on-error cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={rejecting}
            onClick={submitReject}
          >
            確認駁回
          </button>
          <button
            type="button"
            className="border-surface-container text-on-surface-variant cursor-pointer rounded-lg border px-3 py-1.5 text-xs"
            onClick={() => setRejectingUi(false)}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        data-testid={`approve-${suggestion.id}`}
        className="bg-primary text-on-primary cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        disabled={approving}
        onClick={() => confirmApprove()}
      >
        核准
      </button>
      <button
        type="button"
        data-testid={`approve-edit-${suggestion.id}`}
        className="border-primary text-primary cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold"
        onClick={startEditPayload}
      >
        修改後核准
      </button>
      <button
        type="button"
        data-testid={`reject-${suggestion.id}`}
        className="border-surface-container text-on-surface-variant cursor-pointer rounded-lg border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        disabled={rejecting}
        onClick={() => setRejectingUi(true)}
      >
        駁回
      </button>
    </div>
  );
}
