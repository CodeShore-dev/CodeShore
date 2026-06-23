import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { SupabaseView } from '@codeshore/data-types';

import { useCrawlStream } from '../hooks/useCrawlStream';
import { useSwipeCard } from '../hooks/useSwipeCard';
import { JobSwipeCard } from './JobSwipeCard';

interface JobDetailDrawerProps {
  job: SupabaseView.MvJob | undefined;
  isFirst: boolean;
  isLast: boolean;
  loading: boolean;
  preferenceUpdating: boolean;
  listViewPreference: 'like' | 'dislike' | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onUpdatePreference: (preference: 'like' | 'dislike') => void;
}

// Slide-in job detail drawer (task 7.5), ported from JobDetailDrawer.vue.
// Owns the swipe gesture and crawl stream so the swipe stamps, gradient
// overlays, and prefer buttons all share one source of truth.
export function JobDetailDrawer({
  job,
  isFirst,
  isLast,
  loading,
  preferenceUpdating,
  listViewPreference,
  onClose,
  onPrev,
  onNext,
  onUpdatePreference,
}: JobDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const crawl = useCrawlStream();

  const { handlers, cardStyle, commit, flying, likeOpacity, dislikeOpacity } =
    useSwipeCard({
      canLike: () => listViewPreference !== 'like',
      canDislike: () => listViewPreference !== 'dislike',
      onCommit: preference => onUpdatePreference(preference),
    });

  useEffect(() => {
    if (drawerRef.current) drawerRef.current.scrollTop = 0;
  }, [job?.id]);

  if (!job) return null;

  const drawerTitle =
    listViewPreference === 'like'
      ? '● 喜歡的職缺'
      : listViewPreference === 'dislike'
        ? '● 不喜歡的職缺'
        : '● 職缺';

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 ml-auto flex h-full w-full max-w-3xl flex-col bg-[#f4faff] shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-end pr-6"
          style={{
            opacity: likeOpacity,
            background:
              'linear-gradient(to left, rgba(0,61,146,0.28) 0%, transparent 55%)',
          }}
        >
          <div className="-rotate-12 rounded-lg border-4 border-[#003d92] bg-white/90 px-4 py-1 text-2xl font-black tracking-widest text-[#003d92]">
            喜歡
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-start pl-6"
          style={{
            opacity: dislikeOpacity,
            background:
              'linear-gradient(to right, rgba(186,26,26,0.28) 0%, transparent 55%)',
          }}
        >
          <div className="rotate-12 rounded-lg border-4 border-[#ba1a1a] bg-white/90 px-4 py-1 text-2xl font-black tracking-widest text-[#ba1a1a]">
            不喜歡
          </div>
        </div>

        <div ref={drawerRef} className="flex h-full flex-col overflow-y-auto">
          <div className="flex shrink-0 items-center justify-between border-b border-[#001f2a]/6 bg-white px-6 py-4">
            <span className="text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
              {drawerTitle}
            </span>
            <button
              type="button"
              className="cursor-pointer text-[#434653] transition-colors hover:text-[#001f2a]"
              onClick={onClose}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col p-4">
            <JobSwipeCard
              key={job.id}
              job={job}
              cardStyle={cardStyle}
              flying={flying}
              handlers={handlers}
              loading={loading}
              crawl={crawl}
            />
          </div>

          <div
            className={`md:flex hidden shrink-0 items-center justify-center gap-8 border-t border-[#001f2a]/6 bg-white pt-6 pb-10 ${
              loading ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <button
              type="button"
              disabled={isFirst}
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#c9e7f7] text-[#434653] transition-all duration-200 ${
                isFirst
                  ? 'cursor-not-allowed opacity-30'
                  : 'cursor-pointer hover:bg-[#a0d2f0] active:scale-90'
              }`}
              onClick={onPrev}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>

            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={listViewPreference === 'dislike' || preferenceUpdating}
                className={`group flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-all duration-300 ${
                  listViewPreference === 'dislike' || preferenceUpdating
                    ? 'cursor-not-allowed bg-[#ba1a1a] text-white opacity-50'
                    : 'cursor-pointer bg-[#c9e7f7] text-[#434653] hover:bg-[#ba1a1a] hover:text-white active:scale-90'
                }`}
                onClick={() => commit('dislike')}
              >
                <span className="material-symbols-outlined text-3xl transition-transform group-hover:rotate-90">
                  close
                </span>
              </button>
              <span className="text-xs font-medium text-[#434653]">不喜歡</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                disabled={listViewPreference === 'like' || preferenceUpdating}
                className={`group relative flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-[#003d92] to-[#1654b9] text-white shadow-xl transition-all duration-300 ${
                  listViewPreference === 'like' || preferenceUpdating
                    ? 'cursor-not-allowed opacity-50 ring-4 ring-[#003d92] ring-offset-2'
                    : 'cursor-pointer hover:shadow-2xl active:scale-90'
                }`}
                onClick={() => commit('like')}
              >
                <div className="absolute inset-0 animate-ping rounded-full bg-[#003d92] opacity-0 group-hover:opacity-20" />
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  favorite
                </span>
              </button>
              <span className="text-xs font-medium text-[#001f2a]">喜歡</span>
            </div>

            <button
              type="button"
              disabled={isLast}
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#c9e7f7] text-[#434653] transition-all duration-200 ${
                isLast
                  ? 'cursor-not-allowed opacity-30'
                  : 'cursor-pointer hover:bg-[#a0d2f0] active:scale-90'
              }`}
              onClick={onNext}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
