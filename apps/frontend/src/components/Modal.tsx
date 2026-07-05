import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Generic overlay shell (task 1.5). Follows the same portal/backdrop
// convention as ConfirmDialog.tsx (mounts to document.body via createPortal,
// backdrop mousedown closes only when clicking the backdrop itself), but
// sized wider (max-w-2xl) with a scrollable content area to fit richer
// content such as a full technology list.
export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;

  return createPortal(
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8eaf0] px-6 py-4">
          <h2 className="text-lg font-black text-[#001f2a]">{title}</h2>
          <button
            type="button"
            className="-m-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9398a6] transition-colors hover:bg-[#f4faff] hover:text-[#001f2a] focus:ring-2 focus:ring-[#003d92] focus:outline-none"
            aria-label="關閉"
            onClick={onClose}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px' }}
            >
              close
            </span>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
