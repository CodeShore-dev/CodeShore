import type { CommitResult, CommittedChange } from '../service';

interface CurationSessionDoneProps {
  commitResult: CommitResult;
  onNext: () => void;
}

const STATUS_BADGE: Record<
  CommittedChange['status'],
  { label: string; className: string }
> = {
  committed: { label: '已提交', className: 'bg-[#d9f2ff] text-[#003d92]' },
  failed: { label: '失敗', className: 'bg-[#ba1a1a]/10 text-[#ba1a1a]' },
};

const CHANGE_TYPE_LABEL: Record<CommittedChange['type'], string> = {
  tech: '新技術條目',
  tech_keyword: 'Keyword 映射',
  tech_parent: 'Parent-Child 關聯',
  keyword_bin: 'Keyword Bin',
};

// CurationSessionDone (part of task 6.7, requirements 8.1, 9.1, 9.3): renders
// the `done` sessionStatus view. `commitResult.ok: true` renders `.changes`;
// `ok: false` renders `.partialChanges` (requirement 9.3 -- some entries
// `committed`, some `failed`, in the same list). Each row gets a
// per-item committed/failed status badge, distinctly colored per
// frontend-standards.md's palette. A "下一個" button lets the admin move on
// -- `onNext` is expected to call `curationStore.reset()`, which returns the
// session to `idle`; the keyword already dropped out of the queue query via
// `useResumeSessionMutation`'s invalidation (task 5.3), so the queue simply
// re-renders without it.
export function CurationSessionDone({
  commitResult,
  onNext,
}: CurationSessionDoneProps) {
  const changes = commitResult.ok
    ? commitResult.changes
    : commitResult.partialChanges;

  return (
    <div className="rounded-xl border border-[#c3c6d5] bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <p className="text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
        ● 提交結果 · {commitResult.ok ? 'DONE' : 'PARTIAL'}
      </p>
      {!commitResult.ok && (
        <p className="mt-2 text-sm text-[#ba1a1a]">{commitResult.error}</p>
      )}

      <ul className="mt-3 space-y-2">
        {changes.map((change, index) => (
          <ChangeRow key={`${change.type}-${index}`} change={change} />
        ))}
      </ul>

      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full cursor-pointer rounded-lg bg-[#003d92] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9]"
      >
        下一個
      </button>
    </div>
  );
}

function ChangeRow({ change }: { change: CommittedChange }) {
  const badge = STATUS_BADGE[change.status];
  const details = Object.entries(change.details)
    .map(([key, value]) => `${key}: ${value}`)
    .join('、');

  return (
    <li
      data-testid="commit-change-row"
      data-status={change.status}
      className="flex items-center justify-between gap-3 rounded-lg border border-[#c3c6d5] bg-white px-3 py-2"
    >
      <div>
        <p className="text-sm font-bold text-[#001f2a]">
          {CHANGE_TYPE_LABEL[change.type]}
        </p>
        {details && <p className="text-xs text-[#434653]">{details}</p>}
        {change.error && (
          <p className="text-xs text-[#ba1a1a]">{change.error}</p>
        )}
      </div>
      <span
        data-testid={`commit-status-badge-${change.status}`}
        className={`inline-block shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
      >
        {badge.label}
      </span>
    </li>
  );
}
