import { createPortal } from 'react-dom';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Shared, portal-based confirm dialog (task 1.3). Feature-agnostic — mounts to
// document.body via createPortal, matching the existing portal convention used
// by JobDetailDrawer/JobTechPopover (overlay backdrop + centered panel).
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '確認',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-black text-[#001f2a]">{title}</h2>
        {description ? (
          <p className="mb-6 text-sm text-[#434653]">{description}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold text-[#434653] transition-colors hover:bg-[#f4faff]"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg bg-[#ba1a1a] px-3 py-1.5 text-sm font-bold text-white transition-all active:scale-95"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
