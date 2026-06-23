import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Pagination } from '../../../components/Pagination';
import { useCanEdit } from '../../auth/authStore';
import { KeywordGroupBulkToolbar } from '../components/KeywordGroupBulkToolbar';
import { KeywordGroupCard } from '../components/KeywordGroupCard';
import { useKeywordGroupStore, type GroupFilter } from '../keywordGroupStore';
import { useKeywordGroupAdminQuery } from '../queries';
import { useRefreshCatalogMutation } from '../mutations';

const FILTER_OPTIONS: { value: GroupFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'grouped', label: '已入群' },
  { value: 'ungrouped', label: '未入群' },
];

// Admin keyword-group manager page (task 8.3). Ports KeywordGroupManager.vue:
// filter tabs + search + bulk select + card list + pagination, with filter/page
// mirrored into the URL query (parity with the Vue route.query sync).
export function KeywordGroupManagerPage() {
  const canEdit = useCanEdit();
  const [searchParams, setSearchParams] = useSearchParams();

  const groupsFilter = useKeywordGroupStore(s => s.groupsFilter);
  const setGroupsFilter = useKeywordGroupStore(s => s.setGroupsFilter);
  const search = useKeywordGroupStore(s => s.search);
  const setSearch = useKeywordGroupStore(s => s.setSearch);
  const currentPage = useKeywordGroupStore(s => s.currentPage);
  const setPage = useKeywordGroupStore(s => s.setPage);
  const selectMode = useKeywordGroupStore(s => s.selectMode);
  const toggleSelectMode = useKeywordGroupStore(s => s.toggleSelectMode);

  const { keywordGroups, totalCount, totalPages, loading } =
    useKeywordGroupAdminQuery();
  const refresh = useRefreshCatalogMutation();

  const [, setShowCreateModal] = useState(false);

  // Initialize filter/page from the URL once on mount (parity with the Vue
  // setup block reading route.query).
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const filter = (searchParams.get('filter') as GroupFilter) ?? 'all';
    const page = Number(searchParams.get('page')) || 1;
    useKeywordGroupStore.setState({ groupsFilter: filter, currentPage: page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror filter/page back into the URL on change (replace, no history spam).
  useEffect(() => {
    if (!initialized.current) return;
    const next: Record<string, string> = {};
    if (groupsFilter !== 'all') next.filter = groupsFilter;
    if (currentPage > 1) next.page = String(currentPage);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsFilter, currentPage]);

  const showSkeleton = loading || refresh.isPending;

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 關鍵字群組管理 · ADMIN
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[2rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
              關鍵字組
            </h1>
            <p className="mt-1 text-sm text-[#434653]">
              管理關鍵字群組、群組內的關鍵字與分類標籤。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pb-1">
            {!selectMode && canEdit ? (
              <>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl border border-[#c3c6d5] bg-white px-4 py-2 text-sm font-bold text-[#434653] shadow-sm transition hover:bg-[#f4faff] active:scale-95"
                  onClick={toggleSelectMode}
                >
                  <span className="material-symbols-outlined text-base">
                    checklist
                  </span>
                  選取
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl bg-[#003d92] px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-[#1654b9] active:scale-95"
                  onClick={() => refresh.mutate()}
                >
                  <span className="material-symbols-outlined text-base">
                    refresh
                  </span>
                  刷新配對
                </button>
              </>
            ) : (
              canEdit && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-[#c3c6d5] bg-white px-4 py-2 text-sm font-bold text-[#434653] transition hover:bg-[#f4faff] active:scale-95"
                  onClick={toggleSelectMode}
                >
                  取消
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex w-fit items-center gap-1 rounded-xl border border-[#c3c6d5] bg-white p-1 shadow-sm">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                groupsFilter === opt.value
                  ? 'bg-[#003d92] text-white shadow'
                  : 'text-[#434653] hover:bg-[#f4faff]'
              }`}
              onClick={() => setGroupsFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-[#434653]/50">
            search
          </span>
          <input
            value={search}
            type="text"
            placeholder="搜尋群組名稱..."
            className="w-full rounded-xl border border-[#c3c6d5] bg-white py-2 pr-8 pl-8 text-sm font-bold text-[#001f2a] placeholder-[#434653]/50 focus:border-[#003d92] focus:outline-none"
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-[#434653]/50 hover:text-[#434653]"
              onClick={() => setSearch('')}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </div>

      {showSkeleton ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex animate-pulse flex-col gap-2 rounded-xl bg-white px-5 py-4 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-40 rounded bg-[#001f2a]/8" />
                <div className="h-4 w-12 rounded bg-[#001f2a]/8" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded-full bg-[#001f2a]/8" />
                <div className="h-5 w-12 rounded-full bg-[#001f2a]/8" />
                <div className="h-5 w-20 rounded-full bg-[#001f2a]/8" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <KeywordGroupBulkToolbar groups={keywordGroups} />

          <div className="flex flex-col gap-3">
            {keywordGroups.map(group => (
              <KeywordGroupCard key={group.keyword_group} group={group} />
            ))}

            {!totalCount && (
              <div className="flex flex-col items-center justify-center py-20">
                <span className="material-symbols-outlined mb-3 text-5xl text-[#001f2a]/20">
                  label_off
                </span>
                <p className="font-bold text-[#434653]">尚無關鍵字群組。</p>
                {canEdit && (
                  <button
                    type="button"
                    className="mt-4 cursor-pointer rounded-xl bg-[#003d92] px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-[#1654b9] active:scale-95"
                    onClick={() => setShowCreateModal(true)}
                  >
                    建立第一個群組
                  </button>
                )}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}

          {!!totalCount && (
            <p className="mt-3 text-center text-xs font-bold text-[#434653]/50">
              第 {currentPage} 頁，共 {totalPages} 頁・總計 {totalCount} 個群組
            </p>
          )}
        </>
      )}
    </div>
  );
}
