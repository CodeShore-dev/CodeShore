import { useEffect, useRef, useState } from 'react';

import { useCanEdit } from '../../auth/authStore';
import type { useCrawlStream } from '../hooks/useCrawlStream';

interface JobCrawlPanelProps {
  jobId: string;
  crawl: ReturnType<typeof useCrawlStream>;
}

// Re-crawl trigger + live SSE progress log (task 7.5, requirement 3.3),
// ported from JobCrawlPanel.vue. Admin-only; crawl state comes from the
// shared useCrawlStream hook owned by the job card.
export function JobCrawlPanel({ jobId, crawl }: JobCrawlPanelProps) {
  const canEdit = useCanEdit();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isCrawlingThis = crawl.crawlJobId === jobId && !crawl.done;
  const showBox = crawl.crawlJobId === jobId && !dismissed;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [crawl.progress.length]);

  const startCrawl = () => {
    setDismissed(false);
    crawl.start(jobId);
  };

  return (
    <div>
      <button
        type="button"
        onClick={startCrawl}
        disabled={isCrawlingThis || !canEdit}
        className="text-primary hover:bg-primary-container flex h-fit w-fit cursor-pointer items-center justify-center rounded-md pr-2 pl-1 text-sm transition-all hover:text-white active:scale-90 disabled:cursor-not-allowed! disabled:opacity-50"
      >
        <span
          className={`material-symbols-outlined mr-1 text-sm ${
            isCrawlingThis ? 'animate-spin' : ''
          }`}
          data-icon="bug_report"
        >
          {isCrawlingThis ? 'progress_activity' : 'bug_report'}
        </span>
        重新爬取
      </button>

      {showBox && (
        <div className="border-surface-container mt-3 overflow-hidden rounded-lg border">
          <div className="bg-surface-container flex items-center justify-between px-3 py-2">
            <span className="text-on-surface-variant text-sm font-bold tracking-widest">
              爬取進度
            </span>
            {crawl.done ? (
              <button
                type="button"
                className="text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors"
                onClick={() => setDismissed(true)}
              >
                ✕
              </button>
            ) : (
              <span className="material-symbols-outlined text-primary animate-spin text-sm">
                progress_activity
              </span>
            )}
          </div>
          <div
            ref={scrollRef}
            className="bg-surface-container-lowest max-h-48 overflow-y-auto p-3 font-mono text-[11px]"
          >
            {crawl.progress.map((line, i) => (
              <div
                key={i}
                className="text-on-surface-variant leading-5 break-all whitespace-pre-wrap"
              >
                {line}
              </div>
            ))}
            {crawl.done && crawl.progress.length === 0 && (
              <div className="text-on-surface-variant/50 italic">完成</div>
            )}
            {!crawl.done && crawl.progress.length === 0 && (
              <div className="text-on-surface-variant/50 italic">啟動中...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
