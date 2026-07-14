import { KeywordGroup } from '@codeshore/data-types';

interface JobKeywordGroupsProps {
  groups: KeywordGroup[];
  selectedKeywordsSet: Set<string>;
}

export function JobKeywordGroups({
  groups,
  selectedKeywordsSet,
}: JobKeywordGroupsProps) {
  if (!groups.length) return null;
  return (
    <div className="mb-5 rounded-xl bg-[#e6f6ff] p-4">
      <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-[#434653]">
        此 JD 命中的技術
      </div>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g, i) => {
          const isHighlighted =
            selectedKeywordsSet.size > 0 &&
            g.keywords.some(k =>
              selectedKeywordsSet.has(k.toLowerCase()),
            );
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                isHighlighted
                  ? 'bg-[#003d92] text-white'
                  : 'bg-[#003d92]/15 text-[#003d92]'
              }`}
            >
              {g.keywords.join(' / ')}
              {g.keywords.length > 1 && (
                <span
                  className={`rounded px-1 py-px text-[9px] font-normal ${
                    isHighlighted
                      ? 'bg-white/20 text-white'
                      : 'bg-[#003d92]/10 text-[#003d92]/60'
                  }`}
                >
                  擇一
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
