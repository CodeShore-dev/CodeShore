import { TechIcon } from '../../../components/TechIcon';

export interface TechMapping {
  key: string;
  label?: string;
  value: string[];
  icon_slugs?: string[] | null;
}

interface JobTechChipsProps {
  mapping: TechMapping[];
  selectedTechsSet: Set<string>;
}

// Tech groups a JD hit (task 7.5), ported from JobKeywordChips.vue.
export function JobTechChips({
  mapping,
  selectedTechsSet,
}: JobTechChipsProps) {
  if (!mapping.length) return null;
  return (
    <div className="mb-5 rounded-xl bg-[#e6f6ff] p-4">
      <div className="mb-2 text-[11px] font-bold tracking-[0.12em] text-[#434653]">
        此 JD 命中的技術
      </div>
      <div className="flex flex-wrap gap-1.5">
        {mapping.map(m => (
          <span
            key={m.key}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
              selectedTechsSet.size &&
              m.value.some(v => selectedTechsSet.has(v.toLowerCase()))
                ? 'bg-[#003d92] text-white'
                : 'bg-[#003d92]/15 text-[#003d92]'
            }`}
          >
            <TechIcon slugs={m.icon_slugs} label={m.label ?? m.key} size={14} />
            {m.label ?? m.key}
          </span>
        ))}
      </div>
    </div>
  );
}
