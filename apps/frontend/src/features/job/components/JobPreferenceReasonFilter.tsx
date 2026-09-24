import { useEffect, useMemo } from 'react';

import { formatNumber } from '../../../utils/format';
import { useJobFilterStore } from '../jobFilterStore';
import { usePreferenceReasonsQuery } from '../queries';

interface JobPreferenceReasonFilterProps {
  preference: 'like' | 'dislike';
}

const chipBase = 'rounded-md px-3 py-1 text-xs font-bold';
const chipClass = (active: boolean): string =>
  active ? `${chipBase} bg-[#003d92] text-white` : `${chipBase} bg-white text-[#434653] hover:bg-[#f4faff]`;

// Sub-category filter row rendered under the like/dislike tab (Requirements
// 7.1, 7.2, 7.3, 7.7). Counts come from usePreferenceReasonsQuery, which is
// invalidated by every preference mutation (design "queries / mutations /
// store"), so this row updates itself after mark/delete/clear actions.
export function JobPreferenceReasonFilter({ preference }: JobPreferenceReasonFilterProps) {
  const { data } = usePreferenceReasonsQuery(preference);
  const preferenceReason = useJobFilterStore(state => state.preferenceReason);
  const setPreferenceReason = useJobFilterStore(state => state.setPreferenceReason);

  // Zero-count reasons are hidden from the row (they'd be an empty chip a
  // user could select into an empty list).
  const visibleReasons = useMemo(() => (data ?? []).filter(item => item.job_count > 0), [data]);
  // 全部's count is the sum of every reason's job_count, matching the tab's
  // own total (task 6.1 cross-check: 全部 === the like/dislike tab total).
  const totalCount = useMemo(() => (data ?? []).reduce((sum, item) => sum + item.job_count, 0), [data]);

  // If the selected reason drops out of the visible list (deleted, or its
  // last job was unmarked), fall back to 全部 -- but only once data has
  // actually loaded, so an in-flight query never clobbers the selection.
  useEffect(() => {
    if (!data || preferenceReason === null) return;
    const stillVisible = visibleReasons.some(item => item.reason === preferenceReason);
    if (!stillVisible) {
      setPreferenceReason(null);
    }
  }, [data, preferenceReason, visibleReasons, setPreferenceReason]);

  return (
    <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="子分類篩選">
      <button
        type="button"
        aria-pressed={preferenceReason === null}
        onClick={() => setPreferenceReason(null)}
        className={chipClass(preferenceReason === null)}
      >
        全部 <span className="tabular-nums">{formatNumber(totalCount)}</span>
      </button>
      {visibleReasons.map(item => (
        <button
          key={item.reason}
          type="button"
          aria-pressed={preferenceReason === item.reason}
          onClick={() => setPreferenceReason(item.reason)}
          className={chipClass(preferenceReason === item.reason)}
        >
          {item.reason} <span className="tabular-nums">{formatNumber(item.job_count)}</span>
        </button>
      ))}
    </div>
  );
}
