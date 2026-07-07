import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';

import { formatNumber } from '../../../utils/format';
import { useAdminStore } from '../adminStore';
import { AnomalyTable } from '../components/AnomalyTable';
import { LocationGroupTable } from '../components/LocationGroupTable';
import { useUpdateSalaryMutation } from '../mutations';
import {
  useCrawlStatsQuery,
  useEmptyDescriptionQuery,
  useSalaryAnomaliesQuery,
  useUnmappedLocationsQuery,
  useUpdateDateCountsQuery,
} from '../queries';
import { useAdminCrawl } from '../useAdminCrawl';
import { useMvRefresh } from '../useMvRefresh';

interface Condition {
  column: string;
  operator: string;
  value: string;
}

const CONDITION_COLUMNS = [
  { value: 'updated_at', label: '更新時間 updated_at' },
  { value: 'created_at', label: '建立時間 created_at' },
  { value: 'salary_type', label: '薪資類型 salary_type' },
  { value: 'min_salary', label: '最低薪資 min_salary' },
  { value: 'max_salary', label: '最高薪資 max_salary' },
  { value: 'location', label: '地點 location' },
  { value: 'title', label: '標題 title' },
  { value: 'description', label: '職缺描述 description' },
  { value: 'company_id', label: '公司 company_id' },
  { value: 'closed', label: '已關閉 closed' },
  { value: 'salary', label: '薪資字串 salary' },
  { value: 'id', label: '職缺 id' },
];

const CONDITION_OPERATORS = [
  { value: 'eq', label: '= eq' },
  { value: 'neq', label: '≠ neq' },
  { value: 'gt', label: '> gt' },
  { value: 'gte', label: '≥ gte' },
  { value: 'lt', label: '< lt' },
  { value: 'lte', label: '≤ lte' },
  { value: 'ilike', label: '模糊 ilike' },
  { value: 'like', label: '模糊 like' },
  { value: 'is', label: 'is (null)' },
  { value: 'in', label: 'in (a,b)' },
];

// Admin job-monitor page (task 9.1). Port of JobMonitor.vue: crawl stats, crawl
// controls (resume/fresh/conditional), per-day update counts with recrawl, and
// the salary / unmapped-location / empty-description anomaly tables. Gated to
// admins by AdminRoute at the routing layer (task 10.1).
export function JobMonitorPage() {
  const statsDays = useAdminStore(s => s.statsDays);
  const setStatsDays = useAdminStore(s => s.setStatsDays);
  const salaryThreshold = useAdminStore(s => s.salaryThreshold);
  const salaryPage = useAdminStore(s => s.salaryPage);
  const setSalaryPage = useAdminStore(s => s.setSalaryPage);
  const emptyPage = useAdminStore(s => s.emptyPage);
  const setEmptyPage = useAdminStore(s => s.setEmptyPage);
  const selectedDates = useAdminStore(s => s.selectedDates);
  const toggleDate = useAdminStore(s => s.toggleDate);
  const toggleAllDates = useAdminStore(s => s.toggleAllDates);
  const setSelectedDates = useAdminStore(s => s.setSelectedDates);
  const selectedLocationGroups = useAdminStore(s => s.selectedLocationGroups);
  const toggleLocationGroup = useAdminStore(s => s.toggleLocationGroup);
  const toggleAllLocationGroups = useAdminStore(s => s.toggleAllLocationGroups);
  const setSelectedLocationGroups = useAdminStore(
    s => s.setSelectedLocationGroups,
  );

  const { data: stats, isLoading: statsLoading } = useCrawlStatsQuery();
  const salary = useSalaryAnomaliesQuery();
  const empty = useEmptyDescriptionQuery();
  const unmapped = useUnmappedLocationsQuery();
  const updateDates = useUpdateDateCountsQuery();
  const crawl = useAdminCrawl();
  const mvRefresh = useMvRefresh();
  const saveSalaryMutation = useUpdateSalaryMutation();

  const [statsDaysDraft, setStatsDaysDraft] = useState(statsDays);
  const [staleDays, setStaleDays] = useState(30);
  const [conditions, setConditions] = useState<Condition[]>([
    { column: 'updated_at', operator: 'lt', value: '' },
  ]);

  const logRef = useRef<HTMLDivElement | null>(null);
  const mvLogRef = useRef<HTMLDivElement | null>(null);

  // Drop selections whose dates / groups no longer exist after a refetch
  // (parity with the Vue store pruning after loadUpdateDateCounts / loadUnmappedJobs).
  useEffect(() => {
    const valid = new Set(updateDates.dates.map(d => d.updated_date));
    const pruned = selectedDates.filter(d => valid.has(d));
    if (pruned.length !== selectedDates.length) setSelectedDates(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateDates.dates]);

  useEffect(() => {
    const valid = new Set(unmapped.groups.map(g => g.key));
    const pruned = selectedLocationGroups.filter(k => valid.has(k));
    if (pruned.length !== selectedLocationGroups.length) {
      setSelectedLocationGroups(pruned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unmapped.groups]);

  // Keep the crawl log scrolled to the latest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [crawl.progress.length]);

  // Keep the mv-refresh log scrolled to the latest line.
  useEffect(() => {
    if (mvLogRef.current) mvLogRef.current.scrollTop = mvLogRef.current.scrollHeight;
  }, [mvRefresh.progress.length]);

  const conditionWhere = conditions
    .filter(c => c.column && c.operator && c.value !== '')
    .map(c => `${c.column}.${c.operator}.${c.value}`)
    .join(',');

  const patchCondition = (i: number, patch: Partial<Condition>): void =>
    setConditions(cs => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const addCondition = (): void =>
    setConditions(cs => [
      ...cs,
      { column: 'updated_at', operator: 'lt', value: '' },
    ]);

  const removeCondition = (i: number): void =>
    setConditions(cs => {
      const next = cs.filter((_, idx) => idx !== i);
      return next.length
        ? next
        : [{ column: 'updated_at', operator: 'lt', value: '' }];
    });

  const addStaleCondition = (): void =>
    setConditions(cs => [
      ...cs,
      {
        column: 'updated_at',
        operator: 'lt',
        value: dayjs()
          .subtract(staleDays || 0, 'day')
          .startOf('day')
          .format('YYYY-MM-DD'),
      },
    ]);

  const fmtRangeStart = (d?: string): string =>
    d ? dayjs(d).subtract(statsDays, 'day').format('M/D') : '—';

  const recrawlRow = (id: string): void =>
    crawl.start({ mode: 'recrawl-ids', ids: [id] }, `重抓單筆 ${id}`);

  const recrawlSalaryBulk = (): void =>
    crawl.start(
      {
        mode: 'recrawl-anomaly',
        kind: 'salary',
        monthCeil: salaryThreshold.monthCeil,
        yearCeil: salaryThreshold.yearCeil,
      },
      '整批重抓：薪資異常',
    );

  const recrawlEmptyBulk = (): void =>
    crawl.start(
      { mode: 'recrawl-anomaly', kind: 'empty-description' },
      '整批重抓：空 description',
    );

  const runConditionalCrawl = (): void => {
    if (!conditionWhere) return;
    crawl.start(
      { mode: 'recrawl-cond', where: conditionWhere },
      `條件重抓: ${conditionWhere}`,
    );
  };

  const recrawlSelectedDates = (): void => {
    if (!selectedDates.length) return;
    crawl.start(
      { mode: 'recrawl-dates', dates: [...selectedDates] },
      `重抓更新日期：${selectedDates.join('、')}`,
    );
  };

  const recrawlSelectedLocationGroups = (): void => {
    const sel = new Set(selectedLocationGroups);
    const ids = unmapped.groups
      .filter(g => sel.has(g.key))
      .flatMap(g => g.jobs.map(j => j.id));
    if (!ids.length) return;
    crawl.start(
      { mode: 'recrawl-ids', ids },
      `重抓未歸類地點：${sel.size} 組 / ${ids.length} 筆`,
    );
  };

  const showLog =
    crawl.progress.length > 0 || crawl.running || crawl.done;

  const showMvLog =
    mvRefresh.progress.length > 0 || mvRefresh.running || mvRefresh.done;

  return (
    <div className="w-full">
      <header className="mb-6">
        <h1 className="text-on-surface text-2xl font-black">職缺更新監控</h1>
        <p className="text-on-surface-variant mt-1 text-sm">
          爬蟲產出狀況與資料品質檢查（僅限管理員）
        </p>
      </header>

      <div className="text-on-surface-variant mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">統計區間</span>
        <span>最新的日期之近</span>
        <input
          value={statsDaysDraft}
          type="number"
          min={0}
          className="border-surface-container bg-surface-container text-on-surface w-20 rounded-lg border px-2 py-1 text-sm"
          onChange={e => setStatsDaysDraft(e.target.valueAsNumber || 0)}
          onKeyUp={e => {
            if (e.key === 'Enter') setStatsDays(statsDaysDraft);
          }}
        />
        <span>天</span>
        <button
          type="button"
          className="border-surface-container text-on-surface-variant hover:bg-surface-container cursor-pointer rounded-lg border px-3 py-1 text-sm transition"
          disabled={statsLoading}
          onClick={() => setStatsDays(statsDaysDraft)}
        >
          套用
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-surface-container bg-surface-container-lowest rounded-2xl border p-5">
          <div className="text-on-surface-variant flex items-center gap-2 text-sm font-semibold">
            <span className="material-symbols-outlined text-primary">
              fiber_new
            </span>
            新職缺
          </div>
          <div className="text-on-surface mt-2 text-3xl font-black">
            {stats ? formatNumber(stats.new_jobs_count) : '—'}
          </div>
          <div className="text-on-surface-variant mt-1 text-xs">
            {fmtRangeStart(stats?.new_jobs_date)} - 今天
          </div>
        </div>

        <div className="border-surface-container bg-surface-container-lowest rounded-2xl border p-5">
          <div className="text-on-surface-variant flex items-center gap-2 text-sm font-semibold">
            <span className="material-symbols-outlined text-primary">
              update
            </span>
            最近更新職缺
          </div>
          <div className="text-on-surface mt-2 text-3xl font-black">
            {stats ? formatNumber(stats.updated_jobs_count) : '—'}
          </div>
          <div className="text-on-surface-variant mt-1 text-xs">
            {fmtRangeStart(stats?.updated_jobs_date)} - 今天
          </div>
        </div>
      </div>

      <section className="border-surface-container bg-surface-container-lowest mb-8 rounded-2xl border p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            travel_explore
          </span>
          <h3 className="text-on-surface mb-0 font-bold">爬蟲控制</h3>
          {crawl.running && (
            <span className="material-symbols-outlined text-primary animate-spin text-base">
              progress_activity
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <button
            type="button"
            className="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={crawl.running}
            onClick={() => crawl.start({ mode: 'crawl' }, '啟動爬蟲（resume）')}
          >
            啟動爬蟲（resume）
          </button>
          <button
            type="button"
            className="border-primary text-primary hover:bg-primary-container cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={crawl.running}
            onClick={() => crawl.start({ mode: 'fresh' }, '重新開始爬蟲（fresh）')}
          >
            重新開始（fresh）
          </button>
        </div>

        <div className="border-surface-container mt-5 rounded-xl border p-4">
          <div className="text-on-surface-variant mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="material-symbols-outlined text-base">
              filter_alt
            </span>
            條件重抓（自訂篩選參數）
          </div>

          <div className="flex flex-col gap-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={c.column}
                  className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 pr-8 pl-2 text-sm"
                  onChange={e => patchCondition(i, { column: e.target.value })}
                >
                  {CONDITION_COLUMNS.map(col => (
                    <option key={col.value} value={col.value}>
                      {col.label}
                    </option>
                  ))}
                </select>
                <select
                  value={c.operator}
                  className="border-surface-container bg-surface-container text-on-surface rounded-lg border py-1.5 pr-8 pl-2 text-sm"
                  onChange={e => patchCondition(i, { operator: e.target.value })}
                >
                  {CONDITION_OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <input
                  value={c.value}
                  type="text"
                  placeholder="值（例如 2026-05-01 / month / %台北%）"
                  className="border-surface-container bg-surface-container text-on-surface min-w-56 flex-1 rounded-lg border px-2 py-1.5 text-sm"
                  onChange={e => patchCondition(i, { value: e.target.value })}
                />
                <button
                  type="button"
                  className="text-on-surface-variant hover:text-on-surface flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition"
                  title="移除此條件"
                  onClick={() => removeCondition(i)}
                >
                  <span className="material-symbols-outlined text-base">
                    close
                  </span>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <button
              type="button"
              className="border-surface-container text-on-surface-variant hover:bg-surface-container cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition"
              onClick={addCondition}
            >
              ＋ 新增條件
            </button>

            <label className="text-on-surface-variant flex items-end gap-1 text-xs">
              快速：N 天未更新
              <input
                value={staleDays}
                type="number"
                min={0}
                className="border-surface-container bg-surface-container text-on-surface w-20 rounded-lg border px-2 py-1 text-sm"
                onChange={e => setStaleDays(e.target.valueAsNumber || 0)}
              />
              <button
                type="button"
                className="border-surface-container text-on-surface-variant hover:bg-surface-container cursor-pointer rounded-lg border px-2 py-1 transition"
                onClick={addStaleCondition}
              >
                加入
              </button>
            </label>
          </div>

          <div className="text-on-surface-variant mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">where 預覽：</span>
            <code className="bg-surface-container text-on-surface rounded px-2 py-1 font-mono">
              {conditionWhere || '（尚無有效條件）'}
            </code>
          </div>

          <button
            type="button"
            className="bg-primary text-on-primary hover:bg-primary/90 mt-3 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={crawl.running || !conditionWhere}
            onClick={runConditionalCrawl}
          >
            條件重抓
          </button>
        </div>

        {showLog && (
          <div className="border-surface-container mt-4 overflow-hidden rounded-lg border">
            <div className="bg-surface-container flex items-center justify-between px-3 py-2">
              <span className="text-on-surface-variant text-sm font-bold tracking-widest">
                {crawl.label || '爬取進度'}
              </span>
              {crawl.done ? (
                <button
                  type="button"
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors"
                  onClick={crawl.clear}
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
              ref={logRef}
              className="bg-surface-container-lowest max-h-64 overflow-y-auto p-3 font-mono text-[11px]"
            >
              {crawl.progress.map((line, i) => (
                <div
                  key={i}
                  className="text-on-surface-variant leading-5 break-all whitespace-pre-wrap"
                >
                  {line}
                </div>
              ))}
              {!crawl.progress.length && (
                <div className="text-on-surface-variant/50 italic">啟動中…</div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="border-surface-container bg-surface-container-lowest mb-8 rounded-2xl border p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">database</span>
          <h3 className="text-on-surface mb-0 font-bold">物化視圖重整</h3>
          {mvRefresh.running && (
            <span className="material-symbols-outlined text-primary animate-spin text-base">
              progress_activity
            </span>
          )}
        </div>
        <p className="text-on-surface-variant mt-1 text-sm">
          依 mv 依賴關係依序 REFRESH 所有物化視圖，並在 mv_tech 完成後執行關鍵字群組重建（/api/keyword/group/reset）。
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="bg-primary text-on-primary hover:bg-primary/90 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={mvRefresh.running}
            onClick={() => mvRefresh.start()}
          >
            {mvRefresh.errorStep ? '從頭重跑' : '全部重整'}
          </button>
          {mvRefresh.errorStep && !mvRefresh.running && (
            <button
              type="button"
              className="border-primary text-primary hover:bg-primary-container cursor-pointer rounded-lg border px-4 py-2 text-sm font-semibold transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => mvRefresh.start(mvRefresh.errorStep!)}
            >
              從失敗處繼續（{mvRefresh.errorStep}）
            </button>
          )}
          {mvRefresh.running && mvRefresh.currentStep && (
            <span className="text-on-surface-variant text-sm">
              目前執行中：
              <code className="bg-surface-container rounded px-1.5 py-0.5 font-mono">
                {mvRefresh.currentStep}
              </code>
            </span>
          )}
          {mvRefresh.errorStep && (
            <span className="text-error text-sm font-semibold">
              ✕ 失敗於：{mvRefresh.errorStep}
            </span>
          )}
        </div>

        {showMvLog && (
          <div className="border-surface-container mt-4 overflow-hidden rounded-lg border">
            <div className="bg-surface-container flex items-center justify-between px-3 py-2">
              <span className="text-on-surface-variant text-sm font-bold tracking-widest">
                {mvRefresh.done
                  ? mvRefresh.success
                    ? '完成'
                    : '失敗'
                  : '重整進度'}
              </span>
              {mvRefresh.done ? (
                <button
                  type="button"
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer text-sm transition-colors"
                  onClick={mvRefresh.clear}
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
              ref={mvLogRef}
              className="bg-surface-container-lowest max-h-64 overflow-y-auto p-3 font-mono text-[11px]"
            >
              {mvRefresh.progress.map((line, i) => (
                <div
                  key={i}
                  className="text-on-surface-variant leading-5 break-all whitespace-pre-wrap"
                >
                  {line}
                </div>
              ))}
              {!mvRefresh.progress.length && (
                <div className="text-on-surface-variant/50 italic">啟動中…</div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="border-surface-container bg-surface-container-lowest mb-8 overflow-hidden rounded-2xl border">
        <header className="bg-surface-container flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              calendar_month
            </span>
            <h3 className="text-on-surface mb-0 font-bold">每日更新統計</h3>
          </div>
          <button
            type="button"
            className="bg-primary text-on-primary hover:bg-primary/90 flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={crawl.running || !selectedDates.length}
            onClick={recrawlSelectedDates}
          >
            <span className="material-symbols-outlined text-sm">bug_report</span>
            重抓選取日期（{selectedDates.length}）
          </button>
        </header>

        <div className="max-h-96 overflow-auto">
          {updateDates.loading ? (
            <div className="text-on-surface-variant px-3 py-8 text-center text-sm sm:px-5">
              載入中…
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-container-lowest sticky top-0">
                <tr className="text-on-surface-variant border-surface-container border-b text-xs">
                  <th className="w-10 px-3 py-2 sm:px-5">
                    <input
                      type="checkbox"
                      className="accent-primary cursor-pointer"
                      checked={
                        updateDates.dates.length > 0 &&
                        selectedDates.length === updateDates.dates.length
                      }
                      onChange={() =>
                        toggleAllDates(
                          updateDates.dates.map(d => d.updated_date),
                        )
                      }
                    />
                  </th>
                  <th className="px-3 py-2 font-semibold sm:px-5">更新日期</th>
                  <th className="px-3 py-2 text-right font-semibold sm:px-5">
                    數量
                  </th>
                </tr>
              </thead>
              <tbody>
                {updateDates.dates.map(row => (
                  <tr
                    key={row.updated_date}
                    className="border-surface-container/60 hover:bg-surface-container/40 cursor-pointer border-b transition"
                    onClick={() => toggleDate(row.updated_date)}
                  >
                    <td
                      className="px-3 py-2 sm:px-5"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary cursor-pointer"
                        checked={selectedDates.includes(row.updated_date)}
                        onChange={() => toggleDate(row.updated_date)}
                      />
                    </td>
                    <td className="text-on-surface px-3 py-2 font-medium whitespace-nowrap sm:px-5">
                      {row.updated_date}
                    </td>
                    <td className="text-on-surface-variant px-3 py-2 text-right tabular-nums sm:px-5">
                      {formatNumber(row.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-8">
        <AnomalyTable
          title="薪資不合預期"
          icon="payments"
          count={salary.count}
          loading={salary.loading}
          items={salary.items}
          page={salaryPage}
          valueColumn="salary"
          valueLabel="薪資（min ~ max）"
          editableSalary
          crawlRunning={crawl.running}
          onPageChange={setSalaryPage}
          onRecrawlRow={recrawlRow}
          onRecrawlBulk={recrawlSalaryBulk}
          onSaveSalary={({ id, min, max, type }) =>
            saveSalaryMutation.mutate({ id, min, max, type })
          }
        />

        <LocationGroupTable
          groups={unmapped.groups}
          selectedKeys={selectedLocationGroups}
          loading={unmapped.loading}
          crawlRunning={crawl.running}
          onToggle={toggleLocationGroup}
          onToggleAll={() =>
            toggleAllLocationGroups(unmapped.groups.map(g => g.key))
          }
          onRecrawlSelected={recrawlSelectedLocationGroups}
        />

        <AnomalyTable
          title="職缺描述為空"
          icon="description"
          count={empty.count}
          loading={empty.loading}
          items={empty.items}
          page={emptyPage}
          valueColumn="none"
          crawlRunning={crawl.running}
          onPageChange={setEmptyPage}
          onRecrawlRow={recrawlRow}
          onRecrawlBulk={recrawlEmptyBulk}
        />
      </div>
    </div>
  );
}
