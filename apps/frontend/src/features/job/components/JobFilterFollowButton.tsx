import { useMemo } from 'react';

import type { JobFilterSnapshot } from '@codeshore/shared-utils';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { describeFilterSnapshot } from '../../job-filter-watchlist/describeFilterSnapshot';
import { useGuestWatchlistGate } from '../../job-filter-watchlist/hooks/useGuestWatchlistGate';
import { useFollowFilterMutation } from '../../job-filter-watchlist/mutations';
import { isWatchlistLimitReachedError } from '../../job-filter-watchlist/service';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import { useTechsQuery } from '../../keyword/queries';
import { deriveJobWhere } from '../deriveJobWhere';
import { useJobFilterStore } from '../jobFilterStore';

// "Follow this filter" action (task 4.1, design.md's JobFilterSidebar row,
// requirement 1.1-1.4): reads the currently applied filter conditions
// straight from the job/keyword filter stores, builds the same
// JobFilterSnapshot/where the rest of the app already derives via
// deriveJobWhere, and submits a follow request. Guarded by
// useGuestWatchlistGate so a signed-out click shows a login prompt instead
// of creating a subscription (1.4).
//
// Extracted as a sibling of JobFilterSidebar.tsx (rather than inlined
// there) to keep that file under frontend-standards.md's 200-line
// component limit -- still within this task's boundary per design.md's
// explicit "新增「關注此篩選」按鈕" note for this file/area.
export function JobFilterFollowButton() {
  const searchText = useJobFilterStore(s => s.searchText);
  const companyFilters = useJobFilterStore(s => s.companyFilters);
  const salaryFilter = useJobFilterStore(s => s.salaryFilter);
  const salaryAmount = useJobFilterStore(s => s.salaryAmount);
  const selectedLocations = useJobFilterStore(s => s.selectedLocations);

  const selectedTags = useKeywordFilterStore(s => s.selectedTags);
  const excludedTags = useKeywordFilterStore(s => s.excludedTags);
  const keywordOperator = useKeywordFilterStore(s => s.keywordOperator);

  // Tech catalog for resolving selected/excluded tech ids to display labels
  // in the auto-generated description text (design.md's describeFilterSnapshot).
  const techsQuery = useTechsQuery();
  const techLabelsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tech of techsQuery.data ?? []) {
      if (tech.tech) map.set(tech.tech, tech.label ?? tech.tech);
    }
    return map;
  }, [techsQuery.data]);

  // No options passed: `guardMountForGuest` defaults to false, so the
  // hook's own mount effect never auto-opens the prompt just from this
  // button mounting on the /jobs listing page (requirement 1.4 is
  // click-only). `promptOpen` can therefore drive the dialog directly.
  const { promptOpen, requestAction, confirmLogin, cancelPrompt } =
    useGuestWatchlistGate();
  const followMutation = useFollowFilterMutation();

  // The backend's create response body (SubscriptionWithCounts) does not
  // distinguish a fresh 'created' from an 'already_exists' hit -- both are a
  // 2xx with the same shape (design.md's Controller table). So both
  // outcomes are represented identically here: any mutation success means
  // "this combination is now followed" (satisfies requirement 1.3's "讓使用者
  // 可辨識該組合已被關注" without needing to tell the two cases apart).
  const isFollowed = followMutation.isSuccess;
  const limitReached =
    followMutation.isError &&
    isWatchlistLimitReachedError(followMutation.error);

  const handleClick = () => {
    requestAction(() => {
      const snapshot: JobFilterSnapshot = {
        searchText,
        companyFilters,
        salaryFilter,
        salaryAmount,
        selectedLocations,
        selectedTags,
        excludedTags,
        techOperator: keywordOperator,
      };
      const filterWhere = deriveJobWhere(snapshot);
      const label = describeFilterSnapshot(snapshot, techLabelsById);
      followMutation.mutate({ filterSnapshot: snapshot, filterWhere, label });
    });
  };

  return (
    <section className="space-y-2">
      <button
        type="button"
        disabled={isFollowed}
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 ${
          isFollowed
            ? 'cursor-default bg-[#1654b9]'
            : 'bg-[#003d92] hover:bg-[#1654b9]'
        }`}
        onClick={handleClick}
      >
        <span className="material-symbols-outlined text-base leading-none">
          {isFollowed ? 'bookmark_added' : 'bookmark_add'}
        </span>
        {isFollowed ? '已關注' : '關注此篩選'}
      </button>

      {limitReached && (
        <p className="text-xs font-bold text-[#ba1a1a]">已達關注上限</p>
      )}

      <ConfirmDialog
        open={promptOpen}
        title="需要登入"
        description="登入後即可關注目前套用的篩選條件。"
        confirmLabel="前往登入"
        cancelLabel="取消"
        onConfirm={confirmLogin}
        onCancel={cancelPrompt}
      />
    </section>
  );
}
