import { Link } from 'react-router';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { PageSeo } from '../../../components/PageSeo';
import { JobFilterWatchlistItem } from '../components/JobFilterWatchlistItem';
import { useGuestWatchlistGate } from '../hooks/useGuestWatchlistGate';
import { useWatchlistQuery } from '../queries';

// Watchlist page (task 4.2, design.md's JobFilterWatchlistPage, requirements
// 2.1-2.3, 7.1): lists the signed-in user's followed filter combinations
// with each one's totalCount/newCount/lastViewedAt, or a guided empty
// state when nothing is followed yet.
//
// Guest gating: `useGuestWatchlistGate({ guardMountForGuest: true })` is the
// one caller in this feature that opts into mount-time guarding (unlike
// JobFilterFollowButton's click-only gate) so a signed-out direct visit
// shows the login prompt (requirement 7.1). `<JobFilterWatchlistContent />`
// -- the only place `useWatchlistQuery()` is called -- is only ever mounted
// in the `!promptOpen` branch below, so a guest's render tree never
// includes the component that owns the watchlist data fetch/render at all,
// not just a suppressed display of it.
export function JobFilterWatchlistPage() {
  const { promptOpen, confirmLogin, cancelPrompt } = useGuestWatchlistGate({
    guardMountForGuest: true,
  });

  return (
    <div className="w-full">
      <PageSeo
        title="關注篩選"
        description="查看您已關注的職缺篩選組合，掌握符合條件的職缺總數與新職缺動態。"
        noIndex
      />

      {promptOpen ? (
        <ConfirmDialog
          open={promptOpen}
          title="需要登入"
          description="登入後即可查看您的關注清單。"
          confirmLabel="前往登入"
          cancelLabel="取消"
          onConfirm={confirmLogin}
          onCancel={cancelPrompt}
        />
      ) : (
        <JobFilterWatchlistContent />
      )}
    </div>
  );
}

// Separated from the page shell above so it -- and the `useWatchlistQuery()`
// call it owns -- is only ever mounted for a signed-in user (see comment
// above).
function JobFilterWatchlistContent() {
  const watchlistQuery = useWatchlistQuery();
  const subscriptions = watchlistQuery.data ?? [];

  return (
    <>
      <header className="mb-8">
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 關注篩選 · WATCHLIST
        </div>
        <h1 className="text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
          我的關注清單
        </h1>
      </header>

      {!watchlistQuery.isLoading && subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white p-12 text-center shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
          <span className="material-symbols-outlined mb-4 text-6xl text-[#001f2a]/20">
            bookmark_border
          </span>
          <h2 className="mb-2 text-xl font-black text-[#001f2a]">
            尚未關注任何篩選組合
          </h2>
          <p className="mb-6 text-sm text-[#434653]">
            在職缺列表頁套用篩選條件後，點擊「關注此篩選」即可在這裡追蹤符合條件的新職缺動態。
          </p>
          <Link
            to="/jobs"
            className="cursor-pointer rounded-xl bg-[#003d92] px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1654b9] active:scale-95"
          >
            前往職缺列表
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {subscriptions.map(subscription => (
            <JobFilterWatchlistItem
              key={subscription.id}
              subscription={subscription}
              // task 4.3 wires the real markViewed/unfollow behavior; this
              // task only renders the read-only per-item display.
              onView={() => {}}
              onUnfollow={() => {}}
            />
          ))}
        </ul>
      )}
    </>
  );
}
