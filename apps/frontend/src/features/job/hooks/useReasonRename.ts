import { useCallback, useState } from 'react';
import { normalizeReason } from '@codeshore/shared-utils';

import { useJobFilterStore } from '../jobFilterStore';
import { useRenamePreferenceReasonMutation } from '../mutations';
import { useLastReasonMemory } from './useLastReasonMemory';

export type RenameError = 'empty' | 'too_long' | 'duplicate' | 'failed';

export interface UseReasonRenameArgs {
  preference: 'like' | 'dislike';
  // Every name currently listed in the dialog, including the default.
  existing: string[];
  // Called after a successful rename so the dialog can move its selection.
  onRenamed: (oldName: string, newName: string) => void;
}

export interface UseReasonRenameResult {
  renaming: string | null;
  renameError: RenameError | null;
  start: (reason: string) => void;
  cancel: () => void;
  rename: (oldName: string, raw: string) => void;
}

function isConflict(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 409;
}

// Rename state and flow for the reason picker dialog (requirement 9).
export function useReasonRename({
  preference,
  existing,
  onRenamed,
}: UseReasonRenameArgs): UseReasonRenameResult {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<RenameError | null>(null);
  const mutation = useRenamePreferenceReasonMutation();
  const memory = useLastReasonMemory();

  const start = (reason: string) => {
    setRenaming(reason);
    setRenameError(null);
  };

  // Stable so the dialog's Esc listener does not re-subscribe every render.
  const cancel = useCallback(() => {
    setRenaming(null);
    setRenameError(null);
  }, []);

  const rename = (oldName: string, raw: string) => {
    const result = normalizeReason(raw);
    if (!result.ok) {
      setRenameError(result.error); // 9.4
      return;
    }
    const name = result.value;
    if (name === oldName) {
      cancel(); // 9.6: nothing to change, no API call
      return;
    }
    if (existing.includes(name)) {
      setRenameError('duplicate'); // 9.5, includes the default name
      return;
    }
    mutation.mutate(
      { preference, reason: oldName, name },
      {
        onSuccess: () => {
          cancel();
          onRenamed(oldName, name); // 9.7
          // 9.8: follow the new name wherever the old one was remembered.
          if (memory.read(preference) === oldName) memory.remember(preference, name);
          const store = useJobFilterStore.getState();
          if (store.preferenceReason === oldName) store.setPreferenceReason(name);
        },
        onError: (error) => setRenameError(isConflict(error) ? 'duplicate' : 'failed'), // 9.5, 9.9
      },
    );
  };

  return { renaming, renameError, start, cancel, rename };
}
