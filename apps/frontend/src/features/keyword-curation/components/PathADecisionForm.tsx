import { useMemo, useState } from 'react';

import { useTechsQuery } from '../../keyword/queries';

interface PathADecisionFormProps {
  aiSuggestedTechId?: string;
  onSubmit: (decision: { path: 'A'; confirmedTechId: string }) => void;
}

// PathADecisionForm (task 6.3, requirements 4.1, 4.2, 5.1): the human
// decision gate for path A (map keyword -> existing tech). Pre-selects the
// AI's suggested tech (requirement 4.2 -- the AI suggestion is the default,
// editable value), lets the admin search/override it against the full tech
// catalog via useTechsQuery(), and on submit reports whichever tech id is
// currently selected as { path: 'A', confirmedTechId }. No dedicated
// combobox component exists in this repo (see AssignKeywordForm.tsx's plain
// <select> precedent), so this pairs a filter <input> with a native
// <select> over the filtered options -- simple, admin-tool-appropriate.
export function PathADecisionForm({
  aiSuggestedTechId,
  onSubmit,
}: PathADecisionFormProps) {
  const { data: techs = [] } = useTechsQuery();
  const [selectedTechId, setSelectedTechId] = useState(
    aiSuggestedTechId ?? '',
  );
  const [search, setSearch] = useState('');

  // Filters the catalog by id/label, but always keeps the currently
  // selected tech in the option list even if it no longer matches the
  // search text -- otherwise typing a search query could silently drop the
  // pre-selected AI suggestion out of the visible <select> options.
  const filteredTechs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? techs.filter(
          t =>
            t.tech?.toLowerCase().includes(q) ||
            t.label?.toLowerCase().includes(q),
        )
      : techs;
    if (selectedTechId && !base.some(t => t.tech === selectedTechId)) {
      const selected = techs.find(t => t.tech === selectedTechId);
      if (selected) return [selected, ...base];
    }
    return base;
  }, [techs, search, selectedTechId]);

  const handleSubmit = (): void => {
    if (!selectedTechId) return;
    onSubmit({ path: 'A', confirmedTechId: selectedTechId });
  };

  return (
    <div className="rounded-xl border border-[#c3c6d5] bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <label
        className="text-xs font-bold text-[#434653]"
        htmlFor="path-a-tech-search"
      >
        搜尋技術
      </label>
      <input
        id="path-a-tech-search"
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="輸入 id 或名稱搜尋..."
        className="mt-1 w-full rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
      />

      <label
        className="mt-3 block text-xs font-bold text-[#434653]"
        htmlFor="path-a-tech-select"
      >
        目標技術
      </label>
      <select
        id="path-a-tech-select"
        value={selectedTechId}
        onChange={e => setSelectedTechId(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
      >
        <option value="">選擇技術...</option>
        {filteredTechs.map(t => (
          <option key={t.tech} value={t.tech ?? ''}>
            {t.label ?? t.tech} ({t.tech})
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={!selectedTechId}
        onClick={handleSubmit}
        className="mt-4 w-full cursor-pointer rounded-lg bg-[#003d92] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9] disabled:cursor-not-allowed disabled:opacity-50"
      >
        確認映射
      </button>
    </div>
  );
}
