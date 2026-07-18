import dayjs from 'dayjs';
import { Fragment, useState } from 'react';

import { LocationGroupRow } from '../queries';

interface LocationGroupTableProps {
  groups: LocationGroupRow[];
  selectedKeys: string[];
  loading: boolean;
  crawlRunning: boolean;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
  onRecrawlSelected: () => void;
}

const fmt = (d?: string): string => (d ? dayjs(d).format('YYYY-MM-DD') : '—');

// Unmapped-location grouping table (task 9.1). Port of LocationGroupTable.vue:
// expandable rows per location group with bulk recrawl of the selected groups.
export function LocationGroupTable({
  groups,
  selectedKeys,
  loading,
  crawlRunning,
  onToggle,
  onToggleAll,
  onRecrawlSelected,
}: LocationGroupTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (key: string): void =>
    setExpanded(e => ({ ...e, [key]: !e[key] }));

  const allChecked = groups.length > 0 && selectedKeys.length === groups.length;

  return (
    <section className="border-surface-container bg-surface-container-lowest overflow-hidden rounded-2xl border">
      <header className="bg-surface-container flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            location_on
          </span>
          <h3 className="text-on-surface mb-0 font-bold">地點未歸類</h3>
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-bold">
            {groups.length} 組
          </span>
        </div>
        <button
          type="button"
          className="bg-primary text-on-primary hover:bg-primary/90 flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          disabled={crawlRunning || !selectedKeys.length}
          onClick={onRecrawlSelected}
        >
          <span className="material-symbols-outlined text-sm">bug_report</span>
          重抓選取（{selectedKeys.length} 組）
        </button>
      </header>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="text-on-surface-variant px-3 py-8 text-center text-sm sm:px-5">
            載入中…
          </div>
        ) : groups.length === 0 ? (
          <div className="text-on-surface-variant px-3 py-8 text-center text-sm sm:px-5">
            沒有資料 🎉
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="text-on-surface-variant border-surface-container border-b text-xs">
                <th className="w-10 px-3 py-2 sm:px-5">
                  <input
                    type="checkbox"
                    className="accent-primary cursor-pointer"
                    checked={allChecked}
                    onChange={onToggleAll}
                  />
                </th>
                <th className="px-3 py-2 font-semibold sm:px-5">地點</th>
                <th className="px-3 py-2 text-right font-semibold sm:px-5">
                  職缺數
                </th>
                <th className="w-10 px-3 py-2 sm:px-5"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <Fragment key={g.key}>
                  <tr
                    className="border-surface-container/60 hover:bg-surface-container/40 cursor-pointer border-b transition"
                    onClick={() => toggleExpand(g.key)}
                  >
                    <td
                      className="px-3 py-2 sm:px-5"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary cursor-pointer"
                        checked={selectedKeys.includes(g.key)}
                        onChange={() => onToggle(g.key)}
                      />
                    </td>
                    <td className="text-on-surface px-3 py-2 font-medium sm:px-5">
                      {g.location}
                    </td>
                    <td className="text-on-surface-variant px-3 py-2 text-right tabular-nums sm:px-5">
                      {g.count}
                    </td>
                    <td className="px-3 py-2 text-right sm:px-5">
                      <span
                        className={`material-symbols-outlined text-on-surface-variant text-base transition ${
                          expanded[g.key] ? 'rotate-180' : ''
                        }`}
                      >
                        expand_more
                      </span>
                    </td>
                  </tr>
                  {expanded[g.key] && (
                    <tr>
                      <td colSpan={4} className="px-3 pt-1 pb-3 sm:px-5">
                        <div className="border-surface-container/60 flex flex-col gap-1 border-l pl-3">
                          {g.jobs.map(job => (
                            <div
                              key={job.id}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <a
                                href={job.detail_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary line-clamp-1 hover:underline"
                              >
                                {job.title || '(無標題)'}
                              </a>
                              <span className="text-on-surface-variant shrink-0">
                                {job.location || '—'} · {fmt(job.crawled_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
