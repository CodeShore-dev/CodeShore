import { useEffect, useState } from 'react';

import { DEFAULT_PREFERENCE_REASON } from '@codeshore/shared-utils';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import { type ReasonOption, buildReasonOptions } from '../buildReasonOptions';
import { useDeletePreferenceReasonMutation } from '../mutations';
import { usePreferenceReasonsQuery } from '../queries';
import { JobPreferenceReasonAddInput } from './JobPreferenceReasonAddInput';
import { JobPreferenceReasonOptionList } from './JobPreferenceReasonOptionList';

export interface JobPreferenceReasonDialogProps {
  open: boolean;
  preference: 'like' | 'dislike';
  initialReason: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const TITLE = { like: '喜歡的原因', dislike: '不喜歡的原因' } as const;

// Reason picker dialog shell (task 4.3). The body only mounts while `open`,
// so drafts, selection and the delete error vanish whenever the dialog closes
// and start fresh on the next open (4.6). The reason list query is also only
// enabled while open.
export function JobPreferenceReasonDialog(props: JobPreferenceReasonDialogProps) {
  const { data } = usePreferenceReasonsQuery(props.preference, props.open);
  if (!props.open) return null;
  return <ReasonDialogBody {...props} server={data ?? []} />;
}

type BodyProps = JobPreferenceReasonDialogProps & {
  server: { reason: string; job_count: number }[];
};

function ReasonDialogBody({ preference, initialReason, onConfirm, onCancel, server }: BodyProps) {
  const [drafts, setDrafts] = useState<string[]>([]);
  // `picked` is null until the user makes an explicit choice. Until then the
  // selection is derived from `initialReason` against the current options, so
  // it re-resolves by itself when the reason list arrives after opening
  // (6.2), and falls back to the default when the name is unknown or the list
  // failed to load (2.3, 6.4).
  const [picked, setPicked] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReasonOption | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const deleteMutation = useDeletePreferenceReasonMutation();

  const options = buildReasonOptions(server, drafts);
  const has = (reason: string) => options.some(o => o.reason === reason);
  // A name that is no longer listed (e.g. deleted) never stays selected.
  const listed = (reason: string | null) => (reason !== null && has(reason) ? reason : null);
  const selected = listed(picked) ?? listed(initialReason) ?? DEFAULT_PREFERENCE_REASON;

  // Esc cancels the whole dialog, except while the delete confirm is open,
  // where it only closes the confirm (2.5).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Esc during IME composition only cancels the composition.
      if (event.key !== 'Escape' || event.isComposing) return;
      if (pendingDelete) setPendingDelete(null);
      else onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingDelete, onCancel]);

  const handleAdd = (reason: string) => {
    // Duplicate names select the existing item instead of adding a row (4.5).
    if (!has(reason)) setDrafts(prev => [...prev, reason]);
    setPicked(reason); // 4.1
  };

  // Functional update: reads the selection at completion time, not at the
  // time the delete started (5.5).
  const selectDefaultIfSelected = (reason: string) =>
    setPicked(prev => ((prev ?? initialReason) === reason ? DEFAULT_PREFERENCE_REASON : prev));

  const handleDelete = (option: ReasonOption) => {
    setDeleteFailed(false);
    if (option.isDraft) {
      // Drafts only live in this dialog, so no API call is needed.
      setDrafts(prev => prev.filter(d => d !== option.reason));
      selectDefaultIfSelected(option.reason);
      return;
    }
    setPendingDelete(option); // 5.2
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { reason } = pendingDelete;
    setPendingDelete(null);
    deleteMutation.mutate(
      { preference, reason }, // 5.3
      {
        onSuccess: () => selectDefaultIfSelected(reason),
        onError: () => setDeleteFailed(true),
      },
    );
  };

  return (
    <Modal open title={TITLE[preference]} onClose={onCancel}>
      <div className="flex flex-col gap-3">
        <JobPreferenceReasonOptionList
          options={options}
          selected={selected}
          onSelect={setPicked}
          onDelete={handleDelete}
        />
        <JobPreferenceReasonAddInput onAdd={handleAdd} />
        {deleteFailed && (
          <p role="alert" className="text-xs text-[#ba1a1a]">
            刪除失敗
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold text-[#434653] transition-colors hover:bg-[#f4faff]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="cursor-pointer rounded-lg bg-[#003d92] px-3 py-1.5 text-sm font-bold text-white transition-all hover:bg-[#1654b9] active:scale-95"
          >
            確認
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`刪除「${pendingDelete?.reason ?? ''}」？`}
        description={`${pendingDelete?.jobCount ?? 0} 個職缺會改回『${DEFAULT_PREFERENCE_REASON}』`}
        confirmLabel="刪除"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Modal>
  );
}
