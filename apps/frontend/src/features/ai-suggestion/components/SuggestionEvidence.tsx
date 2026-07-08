import { AiSuggestionEvidence } from '../service';

// Renders a suggestion's evidence fields conditionally by shape (requirement
// 7.1, 7.2, 8.1-8.4): not every suggestion has every field (confidence/
// needsVerification/affectedCount/similarItems/conflict/correlationId), so
// each badge only renders when its underlying field is actually present.
export function SuggestionEvidence({
  evidence,
}: {
  evidence: AiSuggestionEvidence;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {typeof evidence.confidence === 'number' && (
        <span
          className="bg-surface-container text-on-surface-variant rounded-full px-2 py-0.5"
          data-testid="evidence-confidence"
        >
          信心度 {Math.round(evidence.confidence * 100)}%
        </span>
      )}
      {evidence.needsVerification && (
        <span
          className="bg-error-container text-on-error-container rounded-full px-2 py-0.5 font-semibold"
          data-testid="evidence-needs-verification"
        >
          需人工查證
        </span>
      )}
      {typeof evidence.affectedCount === 'number' && (
        <span
          className="bg-surface-container text-on-surface-variant rounded-full px-2 py-0.5"
          data-testid="evidence-affected-count"
        >
          影響 {evidence.affectedCount} 筆
        </span>
      )}
      {evidence.conflict && (
        <span
          className="bg-error-container text-on-error-container rounded-full px-2 py-0.5 font-semibold"
          data-testid="evidence-conflict"
        >
          衝突
        </span>
      )}
      {evidence.correlationId && (
        <span
          className="text-on-surface-variant/70 font-mono"
          data-testid="evidence-correlation-id"
        >
          #{evidence.correlationId}
        </span>
      )}
      {!!evidence.similarItems?.length && (
        <div
          className="text-on-surface-variant basis-full"
          data-testid="evidence-similar-items"
        >
          相似項目：
          {evidence.similarItems.map(item => (
            <span key={item.id} className="ml-1 inline-block">
              {item.label}（{Math.round(item.score * 100)}%）
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
