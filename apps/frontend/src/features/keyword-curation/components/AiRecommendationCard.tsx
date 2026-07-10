import type { AiRecommendation } from '../service';

interface AiRecommendationCardProps {
  recommendation: AiRecommendation;
  onManualPathSelect?: (path: 'A' | 'B' | 'C') => void;
}

const PATH_BADGE: Record<
  AiRecommendation['path'],
  { label: string; className: string }
> = {
  A: {
    label: '路徑 A · 映射既有技術',
    className: 'bg-[#d9f2ff] text-[#003d92]',
  },
  B: {
    label: '路徑 B · 建立新技術',
    className: 'bg-[#fd7700]/10 text-[#fd7700]',
  },
  C: {
    label: '路徑 C · 放入 keyword bin',
    className: 'bg-[#001f2a]/[0.08] text-[#434653]',
  },
  ai_failed: {
    label: 'AI 分析失敗',
    className: 'bg-[#ba1a1a]/10 text-[#ba1a1a]',
  },
};

// AiRecommendationCard (task 6.2, requirements 3.1-3.5, 9.2): displays the
// AI's classification recommendation for one of three paths, or the
// ai_failed degradation variant. Purely presentational -- only the
// ai_failed variant needs onManualPathSelect, which lets the admin bypass
// the AI entirely (requirement 3.5, 9.2). Full decision-editing UI for
// paths A/B/C lives in tasks 6.3-6.5's *DecisionForm components; this card
// only DISPLAYS the AI's suggestion.
export function AiRecommendationCard({
  recommendation,
  onManualPathSelect,
}: AiRecommendationCardProps) {
  const badge = PATH_BADGE[recommendation.path];

  return (
    <div className="rounded-xl border border-[#c3c6d5] bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <span
        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
      >
        {badge.label}
      </span>
      <div className="mt-3">
        {renderBody(recommendation, onManualPathSelect)}
      </div>
    </div>
  );
}

function renderBody(
  recommendation: AiRecommendation,
  onManualPathSelect?: (path: 'A' | 'B' | 'C') => void,
) {
  switch (recommendation.path) {
    case 'A':
      return <PathABody recommendation={recommendation} />;
    case 'B':
      return <PathBBody recommendation={recommendation} />;
    case 'C':
      return <PathCBody recommendation={recommendation} />;
    case 'ai_failed':
      return (
        <AiFailedBody
          recommendation={recommendation}
          onManualPathSelect={onManualPathSelect}
        />
      );
  }
}

function AffectedJobCount({ count }: { count: number }) {
  return (
    <p className="mt-2 text-xs text-[#434653]">
      受影響職缺數：<span className="tabular-nums">{count}</span>
    </p>
  );
}

function Reasoning({ text }: { text: string }) {
  return <p className="mt-2 text-sm text-[#001f2a]">{text}</p>;
}

function PathABody({
  recommendation,
}: {
  recommendation: Extract<AiRecommendation, { path: 'A' }>;
}) {
  const { matchedTech, confidence, reasoning, affectedJobCount } =
    recommendation;

  return (
    <div>
      <div className="text-sm font-bold text-[#001f2a]">
        {matchedTech.label}{' '}
        <span className="font-mono text-xs font-normal text-[#434653]">
          {matchedTech.id}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#434653]">
        信心分數：
        <span className="tabular-nums font-bold text-[#003d92]">
          {Math.round(confidence * 100)}%
        </span>
      </p>
      <Reasoning text={reasoning} />
      <AffectedJobCount count={affectedJobCount} />
    </div>
  );
}

function PathBBody({
  recommendation,
}: {
  recommendation: Extract<AiRecommendation, { path: 'B' }>;
}) {
  const { suggestedTech, suggestedEdges, reasoning, affectedJobCount } =
    recommendation;

  return (
    <div>
      <div className="text-sm font-bold text-[#001f2a]">
        {suggestedTech.label}{' '}
        <span className="font-mono text-xs font-normal text-[#434653]">
          {suggestedTech.id}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#434653]">
        分類：{suggestedTech.category}
      </p>
      {suggestedEdges.length > 0 && (
        <p className="mt-1 text-xs text-[#434653]">
          建議關聯：
          <span className="tabular-nums">{suggestedEdges.length}</span> 筆
        </p>
      )}
      <Reasoning text={reasoning} />
      <AffectedJobCount count={affectedJobCount} />
    </div>
  );
}

function PathCBody({
  recommendation,
}: {
  recommendation: Extract<AiRecommendation, { path: 'C' }>;
}) {
  return (
    <div>
      <Reasoning text={recommendation.reasoning} />
      <AffectedJobCount count={recommendation.affectedJobCount} />
    </div>
  );
}

const MANUAL_PATH_OPTIONS: Array<{ path: 'A' | 'B' | 'C'; label: string }> = [
  { path: 'A', label: 'A · 映射既有技術' },
  { path: 'B', label: 'B · 建立新技術' },
  { path: 'C', label: 'C · 放入 keyword bin' },
];

function AiFailedBody({
  recommendation,
  onManualPathSelect,
}: {
  recommendation: Extract<AiRecommendation, { path: 'ai_failed' }>;
  onManualPathSelect?: (path: 'A' | 'B' | 'C') => void;
}) {
  return (
    <div>
      <p className="text-sm text-[#ba1a1a]">{recommendation.error}</p>
      <p className="mt-2 text-sm font-bold text-[#001f2a]">
        請手動選擇路徑
      </p>
      <div className="mt-3 flex gap-2">
        {MANUAL_PATH_OPTIONS.map(option => (
          <button
            key={option.path}
            type="button"
            onClick={() => onManualPathSelect?.(option.path)}
            className="rounded-lg border border-[#c3c6d5] bg-white px-3 py-2 text-xs font-bold text-[#003d92] hover:bg-[#f4faff]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
