import {
  type CSSProperties,
  type PointerEventHandler,
  useState,
} from 'react';

import { SupabaseView } from '@codeshore/data-types';

import type { useCrawlStream } from '../hooks/useCrawlStream';
import { JobCard } from './JobCard';
import { JobSwipeHint } from './JobSwipeHint';

interface SwipeHandlers {
  onPointerDown: PointerEventHandler;
  onPointerMove: PointerEventHandler;
  onPointerUp: PointerEventHandler;
  onPointerCancel: PointerEventHandler;
}

interface JobSwipeCardProps {
  job: SupabaseView.MvJob | undefined;
  cardStyle: CSSProperties;
  flying: 'like' | 'dislike' | null;
  handlers: SwipeHandlers;
  loading: boolean;
  crawl: ReturnType<typeof useCrawlStream>;
}

const HINT_KEY = 'codeshore:job-swipe-hint-dismissed';

// Draggable job card wrapper with swipe hint + fly-out stamp (task 7.5),
// ported from JobSwipeCard.vue. The swipe gesture itself is owned by the
// drawer (useSwipeCard); this renders the visual layers.
export function JobSwipeCard({
  job,
  cardStyle,
  flying,
  handlers,
  loading,
  crawl,
}: JobSwipeCardProps) {
  const [hintDismissed, setHintDismissed] = useState(
    () => localStorage.getItem(HINT_KEY) === '1',
  );
  const dismissHint = () => {
    setHintDismissed(true);
    localStorage.setItem(HINT_KEY, '1');
  };

  return (
    <div className="relative w-full">
      {!hintDismissed && <JobSwipeHint onDismiss={dismissHint} />}

      <div className="relative">
        {flying && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2">
            <span
              className={`material-symbols-outlined text-[120px] drop-shadow-lg ${
                flying === 'like' ? 'text-[#003d92]' : 'text-[#ba1a1a]'
              }`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {flying === 'like' ? 'favorite' : 'close'}
            </span>
            <span
              className={`rounded-lg border-4 px-5 py-1 text-2xl font-black tracking-widest drop-shadow ${
                flying === 'like'
                  ? 'border-[#003d92] bg-white/90 text-[#003d92]'
                  : 'border-[#ba1a1a] bg-white/90 text-[#ba1a1a]'
              }`}
            >
              {flying === 'like' ? '已喜歡' : '已不喜歡'}
            </span>
          </div>
        )}

        <div
          className="relative"
          style={{ ...cardStyle, touchAction: 'pan-y' }}
          {...handlers}
        >
          <JobCard job={job} loading={loading} crawl={crawl} />
        </div>
      </div>
    </div>
  );
}
