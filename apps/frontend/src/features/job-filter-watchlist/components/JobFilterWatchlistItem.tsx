import dayjs from 'dayjs';

import { formatNumber } from '../../../utils/format';
import type { SubscriptionWithCounts } from '../service';

export interface JobFilterWatchlistItemProps {
  subscription: SubscriptionWithCounts;
  onView: () => void;
  onUnfollow: () => void;
}

// Mirrors utils/format.ts's formatDateInfo day/hour/minute relative-time
// bucketing (>10 days -> absolute date, else "N 天前"/"N 小時前"/"N 分鐘前"/
// "剛剛"), but without that utility's hardcoded "重爬" (re-crawled) suffix.
// formatDateInfo was written for job updated_at/crawl timestamps (its only
// other call sites are JobCard.tsx/JobListItem.tsx); lastViewedAt is the
// user's own last-viewed action, and the "上次查看：" label prefix already
// conveys the correct semantics on its own, so no trailing verb is needed.
function formatLastViewedInfo(
  date: dayjs.Dayjs,
  formattedDate: string,
): string {
  const now = dayjs();
  const diffDays = now.diff(date, 'days');
  const diffHours = now.diff(date, 'hours');
  const diffMinutes = now.diff(date, 'minutes');
  if (diffDays > 0) {
    if (diffDays > 10) {
      return formattedDate;
    }
    return diffDays + ' 天前';
  } else if (diffHours > 0) {
    return diffHours + ' 小時前';
  } else if (diffMinutes > 60) {
    return diffMinutes + ' 分鐘前';
  }
  return '剛剛';
}

// Single followed-filter-combination row (design.md's JobFilterWatchlistItem,
// requirements 2.2, 4.1). Read-only presentation of label/totalCount/
// newCount/lastViewedAt; `onView`/`onUnfollow` are invoked as-is by this
// component's own click handlers -- task 4.2's page passes them in as
// no-op placeholders since task 4.3 owns the real markViewed/unfollow
// wiring (design.md's File Structure Plan row for this task only covers
// "頁面組裝", not the mutation wiring).
export function JobFilterWatchlistItem({
  subscription,
  onView,
  onUnfollow,
}: JobFilterWatchlistItemProps) {
  const hasNew = subscription.newCount > 0;
  const lastViewedAt = dayjs(subscription.lastViewedAt);
  const lastViewedInfo = formatLastViewedInfo(
    lastViewedAt,
    subscription.lastViewedAt ? lastViewedAt.format('MM/DD HH:mm') : '--/-- --:--',
  );

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 text-left"
        onClick={onView}
      >
        <span className="truncate text-sm font-bold text-[#001f2a]">
          {subscription.label}
        </span>
        <span className="text-xs text-[#434653]">上次查看：{lastViewedInfo}</span>
      </button>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <div className="text-lg font-black tabular-nums text-[#001f2a]">
            {formatNumber(subscription.totalCount)}
          </div>
          <div className="text-[10px] font-bold tracking-[0.1em] text-[#434653]">
            符合職缺
          </div>
        </div>

        {hasNew ? (
          <span className="rounded-full bg-[#003d92] px-2.5 py-1 text-xs font-bold text-white">
            {formatNumber(subscription.newCount)} 個新職缺
          </span>
        ) : (
          <span className="text-xs font-bold text-[#434653]/60">沒有新職缺</span>
        )}

        <button
          type="button"
          className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold text-[#ba1a1a] transition-colors hover:bg-[#fee2e2]"
          onClick={onUnfollow}
        >
          取消關注
        </button>
      </div>
    </li>
  );
}
