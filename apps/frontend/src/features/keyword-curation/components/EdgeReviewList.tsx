import type { EdgeReviewItem } from '../hooks/usePathBEdges';

const TYPE_LABEL: Record<EdgeReviewItem['suggestion']['type'], string> = {
  parent: '父項',
  child: '子項',
};

interface EdgeReviewListProps {
  items: EdgeReviewItem[];
  onToggleAccepted: (index: number) => void;
  onTechIdChange: (index: number, techId: string) => void;
}

// EdgeReviewList (task 6.4, requirement 6.3, 6.4): renders the AI's
// suggested parent-child edges, each with an accept/reject checkbox and an
// editable target-tech-id input ("每條可個別接受/拒絕/修改目標 tech").
// Extracted out of PathBDecisionForm.tsx to respect the 200-line-per-
// component limit (frontend-standards.md's UI-block split strategy).
export function EdgeReviewList({
  items,
  onToggleAccepted,
  onTechIdChange,
}: EdgeReviewListProps) {
  if (items.length === 0) {
    return <p className="mt-2 text-xs text-[#434653]">AI 未建議任何 parent-child 關聯。</p>;
  }

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={`${item.suggestion.type}-${item.suggestion.techId}-${index}`}
          className="rounded-lg border border-[#c3c6d5] p-3"
        >
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.accepted}
              onChange={() => onToggleAccepted(index)}
              aria-label={`接受 ${TYPE_LABEL[item.suggestion.type]} 關聯：${item.suggestion.techLabel}`}
            />
            <span className="text-xs font-bold text-[#434653]">
              {TYPE_LABEL[item.suggestion.type]}
            </span>
            <input
              type="text"
              value={item.techId}
              onChange={e => onTechIdChange(index, e.target.value)}
              aria-label={`${TYPE_LABEL[item.suggestion.type]} 關聯目標技術 ID：${item.suggestion.techLabel}`}
              className="flex-1 rounded-lg border border-[#c3c6d5] px-2 py-1 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-[#434653]">{item.suggestion.reasoning}</p>
        </li>
      ))}
    </ul>
  );
}
