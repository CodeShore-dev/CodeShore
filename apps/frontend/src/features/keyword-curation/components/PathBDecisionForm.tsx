import { useState } from 'react';

import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { usePathBEdges, parseList } from '../hooks/usePathBEdges';
import type { AiRecommendation, ConfirmedEdge, NewTechFields } from '../service';
import { EdgeReviewList } from './EdgeReviewList';

interface PathBDecisionFormProps {
  recommendation: Extract<AiRecommendation, { path: 'B' }>;
  newTechId: string;
  duplicateIdError?: string;
  onSubmit: (decision: {
    path: 'B';
    newTech: NewTechFields;
    confirmedEdges: ConfirmedEdge[];
  }) => void;
}

// PathBDecisionForm (task 6.4, requirements 4.1, 4.3, 6.1-6.5, 6.8): the
// human decision gate for path B (create a new tech entry). Pre-fills the
// AI's suggested id/label/category/iconSlugs/tags (all editable, requirement
// 6.1, 6.2), lets the admin accept/reject/retarget each suggested
// parent-child edge (requirement 6.3, 6.4 -- delegated to EdgeReviewList +
// usePathBEdges), and runs a front-end-only direct-loop cycle check
// (requirement 6.5 -- UI feedback layer only; the backend's
// validateAndCommitNewTech node performs the authoritative
// detectTechParentCycle() check, task 3.4) that disables submit when
// triggered. `duplicateIdError` surfaces a prior resume's
// `{ ok: false, error: 'duplicate_id' }` (requirement 6.8) next to the id
// field -- the id field is always editable, so this is purely a display
// concern. Split into EdgeReviewList.tsx + hooks/usePathBEdges.ts per
// frontend-standards.md's 200-line-per-component limit.
export function PathBDecisionForm({
  recommendation,
  newTechId,
  duplicateIdError,
  onSubmit,
}: PathBDecisionFormProps) {
  const { suggestedTech, suggestedEdges } = recommendation;
  const [id, setId] = useState(suggestedTech.id || newTechId);
  const [label, setLabel] = useState(suggestedTech.label);
  const [category, setCategory] = useState(suggestedTech.category);
  const [iconSlugsText, setIconSlugsText] = useState(suggestedTech.iconSlugs.join(', '));
  const [tagsText, setTagsText] = useState(suggestedTech.tags.join(', '));

  const { items, toggleAccepted, setTechId, confirmedEdges, hasDirectCycle } = usePathBEdges(
    suggestedEdges,
    id,
  );

  const canSubmit = !hasDirectCycle && id.trim() !== '' && label.trim() !== '';

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    onSubmit({
      path: 'B',
      newTech: {
        id: id.trim(),
        label: label.trim(),
        category,
        iconSlugs: parseList(iconSlugsText),
        tags: parseList(tagsText),
      },
      confirmedEdges,
    });
  };

  return (
    <div className="rounded-xl border border-[#c3c6d5] bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <label className="text-xs font-bold text-[#434653]" htmlFor="path-b-id">
        技術 ID
      </label>
      <input
        id="path-b-id"
        type="text"
        value={id}
        onChange={e => setId(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
      />
      {duplicateIdError && (
        <p className="mt-1 text-xs text-[#ba1a1a]">ID 重複，請修改後重新提交：{duplicateIdError}</p>
      )}

      <label className="mt-3 block text-xs font-bold text-[#434653]" htmlFor="path-b-label">
        名稱
      </label>
      <input
        id="path-b-label"
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
      />

      <label className="mt-3 block text-xs font-bold text-[#434653]" htmlFor="path-b-category">
        分類
      </label>
      <select
        id="path-b-category"
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
      >
        {Object.entries(CATEGORY_LABEL_MAP).map(([value, categoryLabel]) => (
          <option key={value} value={value}>
            {categoryLabel}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-xs font-bold text-[#434653]" htmlFor="path-b-icon-slugs">
        Icon Slugs（以逗號分隔，可留空）
      </label>
      <input
        id="path-b-icon-slugs"
        type="text"
        value={iconSlugsText}
        onChange={e => setIconSlugsText(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
      />

      <label className="mt-3 block text-xs font-bold text-[#434653]" htmlFor="path-b-tags">
        Tags（以逗號分隔，可留空）
      </label>
      <input
        id="path-b-tags"
        type="text"
        value={tagsText}
        onChange={e => setTagsText(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#c3c6d5] px-3 py-2 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
      />

      <p className="mt-4 text-xs font-bold text-[#434653]">Parent-Child 建議關聯</p>
      <EdgeReviewList
        items={items}
        onToggleAccepted={toggleAccepted}
        onTechIdChange={setTechId}
      />
      {hasDirectCycle && (
        <p className="mt-2 text-xs font-bold text-[#ba1a1a]">
          偵測到直接循環關聯（A→B 且 B→A），請取消其中一條後再提交。
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="mt-4 w-full cursor-pointer rounded-lg bg-[#003d92] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1654b9] disabled:cursor-not-allowed disabled:opacity-50"
      >
        確認建立新技術
      </button>
    </div>
  );
}
