import type { UseReasonPickerFlowResult } from '../hooks/useReasonPickerFlow';
import { JobPreferenceReasonDialog } from './JobPreferenceReasonDialog';

interface JobPreferenceReasonPickerProps {
  flow: UseReasonPickerFlowResult;
}

// Renders the reason dialog driven by the marking flow, plus the one-line
// failure notice shown above the job list when a write fails (2.8).
export function JobPreferenceReasonPicker({ flow }: JobPreferenceReasonPickerProps) {
  const { pending } = flow;
  return (
    <>
      {flow.mutationError && (
        <p role="alert" className="mb-2 text-sm font-bold text-[#ba1a1a]">
          標記失敗，請再試一次
        </p>
      )}
      <JobPreferenceReasonDialog
        // Remount on a preference change so the dialog's selection and drafts
        // never carry over between like and dislike.
        key={pending?.preference}
        open={pending !== null}
        preference={pending?.preference ?? 'like'}
        initialReason={pending?.initialReason ?? null}
        onConfirm={flow.confirm}
        onCancel={flow.cancel}
      />
    </>
  );
}
