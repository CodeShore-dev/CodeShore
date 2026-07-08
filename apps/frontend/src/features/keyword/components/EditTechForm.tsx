import { useState, type FormEvent, type MouseEvent } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useUpdateTechMutation } from '../mutations';

interface EditTechFormProps {
  group: SupabaseView.MvTech;
  onDone: () => void;
}

const FIRST_CATEGORY = Object.keys(CATEGORY_LABEL_MAP)[0];

// Inline edit form for an existing tech card (task 5.2), extracted from
// TechCard to keep that component under the 200-line lint limit. Wires
// TechCard's previously-dead isEditing state to the real
// useUpdateTechMutation. Pre-filled from the mv_tech row already on hand
// (category/keywords/parents), matching the same "single parent" model
// useAssignKeywordToGroupMutation already assumes (group.parents?.[0]).
export function EditTechForm({ group, onDone }: EditTechFormProps) {
  const updateTech = useUpdateTechMutation();
  const [category, setCategory] = useState(group.category ?? FIRST_CATEGORY);
  const [tags, setTags] = useState((group.keywords ?? []).join(', '));
  const [parent, setParent] = useState(group.parents?.[0] ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      await updateTech.mutateAsync({
        id: group.tech,
        data: {
          keywords: tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
          category,
          parent: parent.trim() || null,
        },
      });
      onDone();
    } catch {
      setError('更新失敗，請稍後再試。');
    }
  };

  const stop = (e: MouseEvent): void => e.stopPropagation();

  return (
    <div className="border-t border-[#c3c6d5]/20 px-5 py-4" onClick={stop}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-bold text-[#434653]">
            分類
            <select
              value={category}
              className="rounded-lg border border-[#c3c6d5] px-2 py-1.5 text-sm font-normal text-[#001f2a] focus:border-[#003d92] focus:outline-none"
              onChange={e => setCategory(e.target.value)}
            >
              {Object.entries(CATEGORY_LABEL_MAP).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-bold text-[#434653]">
            父技術 ID（可留空）
            <input
              value={parent}
              type="text"
              className="rounded-lg border border-[#c3c6d5] px-2 py-1.5 text-sm font-normal text-[#001f2a] focus:border-[#003d92] focus:outline-none"
              onChange={e => setParent(e.target.value)}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-bold text-[#434653]">
          關鍵字（以逗號分隔）
          <input
            value={tags}
            type="text"
            className="rounded-lg border border-[#c3c6d5] px-2 py-1.5 text-sm font-normal text-[#001f2a] focus:border-[#003d92] focus:outline-none"
            onChange={e => setTags(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-[#434653] transition hover:bg-[#f4faff]"
            onClick={onDone}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={updateTech.isPending}
            className="cursor-pointer rounded-lg bg-[#003d92] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1654b9] disabled:opacity-50"
          >
            儲存
          </button>
        </div>
      </form>
    </div>
  );
}
