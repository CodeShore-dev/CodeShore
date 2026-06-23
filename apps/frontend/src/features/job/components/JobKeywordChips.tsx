export interface KeywordGroupMapping {
  key: string;
  label?: string;
  value: string[];
}

interface JobKeywordChipsProps {
  mapping: KeywordGroupMapping[];
  selectedKeywordsSet: Set<string>;
}

// Keyword groups a JD hit (task 7.5), ported from JobKeywordChips.vue.
export function JobKeywordChips({
  mapping,
  selectedKeywordsSet,
}: JobKeywordChipsProps) {
  if (!mapping.length) return null;
  return (
    <div className="mb-5 rounded-xl bg-[#e6f6ff] p-4">
      <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-[#434653]">
        此 JD 命中的關鍵字
      </div>
      <div className="flex flex-wrap gap-1.5">
        {mapping.map(m => (
          <span
            key={m.key}
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${
              selectedKeywordsSet.size &&
              m.value.some(v => selectedKeywordsSet.has(v.toLowerCase()))
                ? 'bg-[#003d92] text-white'
                : 'bg-[#003d92]/15 text-[#003d92]'
            }`}
          >
            {m.label ?? m.key}
          </span>
        ))}
      </div>
    </div>
  );
}
