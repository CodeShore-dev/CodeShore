import { useState, type MouseEvent } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { useAssignKeywordToGroupMutation } from '../mutations';
import { useTechsQuery } from '../queries';

interface AssignKeywordFormProps {
  group: SupabaseView.MvTech;
  onDone: () => void;
}

// Inline "merge bare keyword into an existing tech" form (task 5.2),
// extracted from TechCard to keep that component under the 200-line lint
// limit. Wires TechCard's previously-dead assigningKeyword state to the real
// useAssignKeywordToGroupMutation. The target list is a plain <select> over
// the already-fetched shared catalog (useTechsQuery, category !== null) --
// no search/autocomplete, per the task's "keep it simple" scope.
export function AssignKeywordForm({ group, onDone }: AssignKeywordFormProps) {
  const { data: techs = [] } = useTechsQuery();
  const assign = useAssignKeywordToGroupMutation();
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (): Promise<void> => {
    const targetGroup = techs.find(t => t.tech === target);
    if (!targetGroup) {
      setError('請選擇要加入的技術');
      return;
    }
    try {
      await assign.mutateAsync({ keyword: group.tech, group: targetGroup });
      onDone();
    } catch {
      setError('加入失敗，請稍後再試。');
    }
  };

  const stop = (e: MouseEvent): void => e.stopPropagation();

  return (
    <div className="flex flex-wrap items-center gap-2" onClick={stop}>
      <select
        value={target}
        className="rounded-lg border border-[#c3c6d5] px-2 py-1.5 text-sm text-[#001f2a] focus:border-[#003d92] focus:outline-none"
        onChange={e => setTarget(e.target.value)}
      >
        <option value="">選擇技術...</option>
        {techs.map(t => (
          <option key={t.tech} value={t.tech}>
            {t.label ?? t.tech}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!target || assign.isPending}
        className="cursor-pointer rounded-lg bg-[#003d92] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[#1654b9] disabled:opacity-50"
        onClick={handleConfirm}
      >
        確認
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold text-[#434653] transition hover:bg-[#f4faff]"
        onClick={onDone}
      >
        取消
      </button>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
}
