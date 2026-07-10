import type { HumanDecision } from '../service';

interface CommitPreviewPanelProps {
  keyword: string;
  decision: HumanDecision;
}

// CommitPreviewPanel (task 6.6, requirements 5.1, 6.6, 7.1): a read-only,
// presentational preview of exactly what will be written to the database if
// the admin confirms the currently-pending (not-yet-submitted) HumanDecision
// from whichever path form is active. `decision` is lifted from the parent
// (CurationSession, task 6.7) and mirrors the live in-progress selection --
// it is the same shape as the resume-mutation payload, so this component can
// preview it verbatim without any translation layer. No submit/cancel
// buttons live here; those belong to the individual PathA/B/CDecisionForm
// components (task 6.3/6.4/6.5).
export function CommitPreviewPanel({ keyword, decision }: CommitPreviewPanelProps) {
  return (
    <div
      data-testid="commit-preview-panel"
      className="rounded-xl border border-[#c3c6d5] bg-[#f4faff] p-4"
    >
      <p className="text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
        ● 提交預覽 · PREVIEW
      </p>

      {decision.path === 'A' && (
        <p data-testid="preview-mapping-row" className="mt-2 text-sm text-[#001f2a]">
          <span className="font-bold">{keyword}</span> →{' '}
          <span className="font-bold">{decision.confirmedTechId}</span> 映射
        </p>
      )}

      {decision.path === 'B' && (
        <div className="mt-2 space-y-3">
          <div data-testid="preview-new-tech" className="rounded-lg bg-white p-3 text-sm text-[#001f2a]">
            <p className="font-bold text-[#434653]">新技術條目</p>
            <p>id：{decision.newTech.id}</p>
            <p>名稱：{decision.newTech.label}</p>
            <p>分類：{decision.newTech.category}</p>
            <p>Icon Slugs：{decision.newTech.iconSlugs.join(', ') || '（無）'}</p>
            <p>Tags：{decision.newTech.tags.join(', ') || '（無）'}</p>
          </div>

          <p data-testid="preview-mapping-row" className="text-sm text-[#001f2a]">
            <span className="font-bold">{keyword}</span> →{' '}
            <span className="font-bold">{decision.newTech.id}</span> 映射
          </p>

          <div>
            <p className="text-xs font-bold text-[#434653]">Parent-Child 邊（{decision.confirmedEdges.length}）</p>
            {decision.confirmedEdges.length === 0 ? (
              <p className="mt-1 text-xs text-[#434653]">（無確認的關聯）</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {decision.confirmedEdges.map(edge => (
                  <li
                    key={`${edge.parentId}->${edge.childId}`}
                    data-testid="preview-edge-item"
                    className="rounded bg-white px-2 py-1 text-sm text-[#001f2a]"
                  >
                    {edge.parentId} → {edge.childId}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {decision.path === 'C' && (
        <p data-testid="preview-bin-row" className="mt-2 text-sm text-[#001f2a]">
          <span className="font-bold">{keyword}</span> 將加入 keyword bin
        </p>
      )}
    </div>
  );
}
