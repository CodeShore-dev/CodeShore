interface PathCDecisionFormProps {
  onSubmit: (decision: { path: 'C' }) => void;
  onCancel: () => void;
}

// PathCDecisionForm (task 6.5, requirements 4.1, 4.4, 7.1): the human
// decision gate for path C (put keyword into keyword_bin, i.e. mark it as
// noise). This is the simplest of the three decision forms -- no fields to
// edit, just a confirmation prompt. Confirming reports { path: 'C' } to the
// caller (which resumes the LangGraph session); cancelling calls onCancel()
// only, returning to path selection without triggering any resume mutation
// (requirement 4.4).
export function PathCDecisionForm({
  onSubmit,
  onCancel,
}: PathCDecisionFormProps) {
  const handleSubmit = (): void => {
    onSubmit({ path: 'C' });
  };

  return (
    <div className="rounded-xl border border-[#c3c6d5] bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <p className="text-sm text-[#001f2a]">
        此 keyword 將被標記為噪音，並排除於未來所有工作流候選之外。
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 cursor-pointer rounded-lg border border-[#c3c6d5] bg-white px-3 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#f4faff]"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 cursor-pointer rounded-lg bg-[#003d92] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9]"
        >
          確認放入 Keyword Bin
        </button>
      </div>
    </div>
  );
}
