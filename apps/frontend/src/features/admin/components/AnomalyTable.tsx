import dayjs from 'dayjs';
import { type ReactNode, useEffect, useState } from 'react';

import { Pagination } from '../../../components/Pagination';
import { ADMIN_PAGE_SIZE } from '../queries';
import { AnomalyJob } from '../service';

interface SalaryDraft {
  min: number;
  max: number;
  type: 'month' | 'year';
}

interface AnomalyTableProps {
  title: string;
  icon: string;
  count: number;
  loading: boolean;
  items: AnomalyJob[];
  page: number;
  pageSize?: number;
  valueColumn: 'salary' | 'location' | 'none';
  valueLabel?: string;
  crawlRunning: boolean;
  editableSalary?: boolean;
  controls?: ReactNode;
  onPageChange: (page: number) => void;
  onRecrawlRow: (id: string) => void;
  onRecrawlBulk: () => void;
  onSaveSalary?: (payload: SalaryDraft & { id: string }) => void;
}

const fmt = (d?: string): string => (d ? dayjs(d).format('YYYY-MM-DD') : '—');

// Anomaly job table (task 9.1). Port of AnomalyTable.vue: per-row recrawl, bulk
// recrawl, optional inline salary editing, and pagination.
export function AnomalyTable({
  title,
  icon,
  count,
  loading,
  items,
  page,
  pageSize = ADMIN_PAGE_SIZE,
  valueColumn,
  valueLabel,
  crawlRunning,
  editableSalary = false,
  controls,
  onPageChange,
  onRecrawlRow,
  onRecrawlBulk,
  onSaveSalary,
}: AnomalyTableProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const [draft, setDraft] = useState<Record<string, SalaryDraft>>({});
  useEffect(() => {
    if (!editableSalary) return;
    const next: Record<string, SalaryDraft> = {};
    for (const j of items) {
      next[j.id] = {
        min: j.min_salary ?? 0,
        max: j.max_salary ?? 0,
        type: j.salary_type === 'year' ? 'year' : 'month',
      };
    }
    setDraft(next);
  }, [items, editableSalary]);

  const patchDraft = (id: string, patch: Partial<SalaryDraft>): void =>
    setDraft(d => ({ ...d, [id]: { ...d[id], ...patch } }));

  const saveSalary = (job: AnomalyJob): void => {
    const d = draft[job.id];
    if (!d || !onSaveSalary) return;
    onSaveSalary({ id: job.id, min: d.min, max: d.max, type: d.type });
  };

  return (
    <section className="border-surface-container bg-surface-container-lowest overflow-hidden rounded-2xl border">
      <header className="bg-surface-container flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">{icon}</span>
          <h3 className="text-on-surface mb-0 font-bold">{title}</h3>
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-bold">
            {count}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {controls}
          <button
            type="button"
            className="bg-primary text-on-primary hover:bg-primary/90 flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={crawlRunning || count === 0}
            onClick={onRecrawlBulk}
          >
            <span className="material-symbols-outlined text-sm">bug_report</span>
            整批重抓
          </button>
        </div>
      </header>

      <div className="relative overflow-x-auto">
        {loading ? (
          <div className="text-on-surface-variant px-3 py-8 text-center text-sm sm:px-5">
            載入中…
          </div>
        ) : items.length === 0 ? (
          <div className="text-on-surface-variant px-3 py-8 text-center text-sm sm:px-5">
            沒有資料 🎉
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="text-on-surface-variant border-surface-container border-b text-xs">
                <th className="px-3 py-2 font-semibold sm:px-5">職缺標題</th>
                {valueColumn !== 'none' && (
                  <th className="px-3 py-2 font-semibold sm:px-5">
                    {valueLabel}
                  </th>
                )}
                <th className="px-3 py-2 font-semibold sm:px-5">更新時間</th>
                <th className="px-3 py-2 text-right font-semibold sm:px-5">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map(job => (
                <tr
                  key={job.id}
                  className="border-surface-container/60 hover:bg-surface-container/40 border-b transition"
                >
                  <td className="max-w-xs px-3 py-2 sm:px-5">
                    <a
                      href={job.detail_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary line-clamp-1 font-medium hover:underline"
                    >
                      {job.title || '(無標題)'}
                    </a>
                  </td>
                  {valueColumn !== 'none' && (
                    <td className="text-on-surface-variant px-3 py-2 sm:px-5">
                      {editableSalary ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-on-surface-variant/80 line-clamp-1 text-xs">
                            {job.salary || '—'}
                            {job.salary_manual && (
                              <span className="bg-primary/10 text-primary ml-1 rounded px-1 py-0.5 text-[10px] font-bold">
                                人工
                              </span>
                            )}
                          </span>
                          {draft[job.id] && (
                            <div className="flex items-center gap-1">
                              <select
                                value={draft[job.id].type}
                                className="border-surface-container bg-surface-container text-on-surface rounded border py-1 pr-8 pl-2 text-sm"
                                onChange={e =>
                                  patchDraft(job.id, {
                                    type: e.target.value as 'month' | 'year',
                                  })
                                }
                              >
                                <option value="month">月</option>
                                <option value="year">年</option>
                              </select>
                              <input
                                value={draft[job.id].min}
                                type="number"
                                className="border-surface-container bg-surface-container text-on-surface w-24 rounded border px-2 py-1 text-sm"
                                onChange={e =>
                                  patchDraft(job.id, {
                                    min: e.target.valueAsNumber || 0,
                                  })
                                }
                              />
                              <span className="text-xs">~</span>
                              <input
                                value={draft[job.id].max}
                                type="number"
                                className="border-surface-container bg-surface-container text-on-surface w-24 rounded border px-2 py-1 text-sm"
                                onChange={e =>
                                  patchDraft(job.id, {
                                    max: e.target.valueAsNumber || 0,
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={loading}
                                onClick={() => saveSalary(job)}
                              >
                                儲存
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="line-clamp-1">
                          {(valueColumn === 'salary'
                            ? job.salary
                            : job.location) || '—'}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="text-on-surface-variant px-3 py-2 whitespace-nowrap sm:px-5">
                    {fmt(job.crawled_at)}
                  </td>
                  <td className="px-3 py-2 text-right sm:px-5">
                    <button
                      type="button"
                      className="text-primary hover:bg-primary-container inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={crawlRunning}
                      onClick={() => onRecrawlRow(job.id)}
                    >
                      <span className="material-symbols-outlined text-sm">
                        bug_report
                      </span>
                      重抓
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-3 pb-4 sm:px-5">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </section>
  );
}
