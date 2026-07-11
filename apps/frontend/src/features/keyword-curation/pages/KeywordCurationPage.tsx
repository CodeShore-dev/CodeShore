import { useEffect, useState } from 'react';

import { CurationSession } from '../components/CurationSession';
import { KeywordQueueList } from '../components/KeywordQueueList';
import { useStartSessionMutation } from '../mutations';
import { useKeywordQueueQuery } from '../queries';

// KeywordCurationPage (task 7.1, requirements 1.1, 1.3, 2.1, 8.1, 8.2): the
// two-column page container. Left column is `KeywordQueueList` (already
// fetches its own data via `useKeywordQueueQuery()` and reads
// session-in-progress state directly from `curationStore` -- see that
// component's own doc comment); this page only supplies `onSelectKeyword`,
// wired straight to `useStartSessionMutation().mutate`. Right column is
// `CurationSession`, which reads the entire session state machine from
// `curationStore` on its own and needs no props.
//
// Requirement 8.2 ("中途退出不回滾"): no manual reset-wiring is needed here.
// `curationStore.reset()` is already invoked by `CurationSessionDone`'s
// "下一個" button (task 6.7) whenever the admin moves on from a completed
// keyword, and `useResumeSessionMutation` (task 5.3) already invalidates the
// queue query on success. This page does not need its own reset trigger --
// leaving mid-session simply leaves whatever has already been committed to
// the database in place, which is the desired behavior, and nothing in this
// component rolls that back.
//
// Progress count (requirement 8.1: "在整個操作過程中持續顯示已處理 keyword 數量與
// 佇列總數（例如：3 / 47）"). `useKeywordQueueQuery()` only ever returns the
// keywords that are CURRENTLY still eligible/unmapped -- there is no
// persisted "how many were ever in the queue" baseline anywhere in this
// feature's existing state (no such field exists on `curationStore`, in
// `QueuedKeyword`, or in any query/service response). The most practical
// interpretation given what data actually exists: this page captures a
// local high-water-mark (`queueTotal`) the FIRST time the queue query
// resolves with data, and holds it fixed for the rest of this page's
// mounted lifetime. "佇列總數" = that captured high-water-mark; "已處理" =
// high-water-mark minus the currently-remaining count, which grows as
// keywords are resumed and drop out of the query's cached list. A full
// page remount (e.g. navigating away and back) naturally re-captures a
// fresh baseline from the queue as it stands at that point -- this is
// consistent with requirement 8.2, since nothing here rolls back
// already-committed keyword-curation results; it only resets what counts
// as "the total" for a new viewing of the page.
export function KeywordCurationPage() {
  const { data, isLoading } = useKeywordQueueQuery();
  const { mutate: startSession } = useStartSessionMutation();

  const [queueTotal, setQueueTotal] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (queueTotal === undefined && data) {
      setQueueTotal(data.keywords.length);
    }
  }, [data, queueTotal]);

  const remaining = data?.keywords.length ?? 0;
  const total = queueTotal ?? remaining;
  const processed = Math.max(total - remaining, 0);

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 關鍵字策展 · ADMIN
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[2rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
              關鍵字策展
            </h1>
            <p className="mt-1 text-sm text-[#434653]">
              逐一審視未映射 keyword，於引導式流程中完成 AI 分析、決策與提交。
            </p>
          </div>
          {!isLoading && (
            <p
              data-testid="curation-progress-count"
              className="pb-1 text-sm font-bold tabular-nums text-[#434653]"
            >
              {processed} / {total}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
        <div className="rounded-2xl border border-[#c3c6d5] bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
          <KeywordQueueList onSelectKeyword={startSession} />
        </div>
        <div className="rounded-2xl border border-[#c3c6d5] bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
          <CurationSession />
        </div>
      </div>
    </div>
  );
}
