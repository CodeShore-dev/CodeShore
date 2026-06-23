import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Pagination } from '../../../components/Pagination';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useHomeData } from '../../home/hooks/useHomeData';
import { InfoHint } from '../../methodology/components/InfoHint';
import { TechRankingCard } from '../components/TechRankingCard';
import { type RankingMode, useTechRanking } from '../hooks/useTechRanking';

const PAGE_SIZE = 24;

const MODE_OPTIONS: { value: RankingMode; label: string }[] = [
  { value: 'popular', label: '熱門技術' },
  { value: 'salary-year', label: '高薪 · 年薪' },
  { value: 'salary-month', label: '高薪 · 月薪' },
];

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL_MAP).map(
  ([value, label]) => ({ value, label }),
);

function isMode(v: unknown): v is RankingMode {
  return v === 'popular' || v === 'salary-year' || v === 'salary-month';
}

export function TechRankingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = isMode(searchParams.get('mode'))
    ? (searchParams.get('mode') as RankingMode)
    : 'popular';

  const [mode, setMode] = useState<RankingMode>(initialMode);
  const [category, setCategory] = useState('language');
  const [page, setPage] = useState(1);

  const { items, totalCount, loading, fetchPage } = useTechRanking();
  const { salaryBenchmarks } = useHomeData();

  const type = mode === 'salary-month' ? 'month' : 'year';
  const salaryMedian =
    mode === 'popular' ? 0 : salaryBenchmarks[type].median;

  useEffect(() => {
    fetchPage({ mode, category, page, pageSize: PAGE_SIZE, salaryMedian });
  }, [mode, category, page, salaryMedian, fetchPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const heading =
    mode === 'popular' ? '最多職缺要的技術' : '開最高薪的技術';

  const changeMode = (value: RankingMode) => {
    if (value === mode) return;
    setMode(value);
    setPage(1);
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('mode', value);
        return next;
      },
      { replace: true },
    );
  };

  const changeCategory = (value: string) => {
    if (value === category) return;
    setCategory(value);
    setPage(1);
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 技術排行 · TECH RANKING
        </div>
        <div className="flex items-end justify-between gap-4">
          <h1 className="flex items-start gap-1.5 text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
            {heading}
            <InfoHint metric="techs.ranking" />
          </h1>
          {!loading && (
            <span className="shrink-0 pb-1 text-sm font-semibold text-[#434653]">
              共 {totalCount.toLocaleString()} 項
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 flex w-full flex-wrap overflow-hidden rounded-lg border border-[#c9e7f7] text-sm md:w-fit">
        {MODE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`flex-1 cursor-pointer px-4 py-2 font-bold transition-colors md:flex-none ${
              mode === opt.value
                ? 'bg-[#003d92] text-white'
                : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
            }`}
            onClick={() => changeMode(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {CATEGORY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={`cursor-pointer rounded-lg border px-3.5 py-1.5 font-bold transition-colors ${
              category === opt.value
                ? 'border-[#003d92] bg-[#003d92] text-white'
                : 'border-[#c9e7f7] bg-white text-[#434653] hover:bg-[#d9f2ff]'
            }`}
            onClick={() => changeCategory(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-[#d9f2ff]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center">
          <div className="mb-3 text-5xl font-black text-[#001f2a]/10">0</div>
          <p className="text-sm font-bold text-[#434653]">
            這個類別下沒有符合條件的技術
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item, i) => (
              <TechRankingCard
                key={item.keyword_group}
                item={item}
                rank={(page - 1) * PAGE_SIZE + i + 1}
                mode={mode}
              />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
