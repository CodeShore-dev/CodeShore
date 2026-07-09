import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Pagination } from '../../../components/Pagination';
import { PageSeo } from '../../../components/PageSeo';
import { env } from '../../../config/env';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { useHomeData } from '../../home/hooks/useHomeData';
import { InfoHint } from '../../methodology/components/InfoHint';
import { TechsFilterBar } from '../components/TechsFilterBar';
import { TechsTable } from '../components/TechsTable';
import { useTechCombos } from '../hooks/useTechCombos';
import { type RankingMode, useTechRanking } from '../hooks/useTechRanking';

const PAGE_SIZE = 24;

type TechsMode = RankingMode | 'combos';

const MODE_OPTIONS: { value: TechsMode; label: string }[] = [
  { value: 'popular', label: '熱門技術' },
  { value: 'salary-year', label: '高薪 · 年薪' },
  { value: 'salary-month', label: '高薪 · 月薪' },
  { value: 'combos', label: '技術組合' },
];

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL_MAP).map(
  ([value, label]) => ({ value, label }),
);
const COMBO_CATEGORY_OPTIONS = [
  { value: 'all', label: '全部' },
  ...CATEGORY_OPTIONS,
];

function isMode(v: unknown): v is TechsMode {
  return (
    v === 'popular' ||
    v === 'salary-year' ||
    v === 'salary-month' ||
    v === 'combos'
  );
}

export function TechsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = isMode(searchParams.get('mode'))
    ? (searchParams.get('mode') as TechsMode)
    : 'popular';

  const [mode, setMode] = useState<TechsMode>(initialMode);
  const [category, setCategory] = useState(
    initialMode === 'combos' ? 'all' : 'language',
  );
  const [page, setPage] = useState(1);

  const isCombos = mode === 'combos';

  const {
    items: rankingItems,
    totalCount: rankingTotal,
    loading: rankingLoading,
    fetchPage: fetchRankingPage,
  } = useTechRanking();
  const {
    items: comboItems,
    totalCount: comboTotal,
    loading: comboLoading,
    fetchPage: fetchComboPage,
  } = useTechCombos();
  const { salaryBenchmarks } = useHomeData();

  const type = mode === 'salary-month' ? 'month' : 'year';
  const salaryMedian =
    mode === 'popular' || isCombos ? 0 : salaryBenchmarks[type].median;

  useEffect(() => {
    if (mode === 'combos') {
      fetchComboPage({ category, page, pageSize: PAGE_SIZE });
    } else {
      fetchRankingPage({
        mode,
        category,
        page,
        pageSize: PAGE_SIZE,
        salaryMedian,
      });
    }
  }, [
    mode,
    category,
    page,
    salaryMedian,
    isCombos,
    fetchComboPage,
    fetchRankingPage,
  ]);

  const items = isCombos ? comboItems : rankingItems;
  const totalCount = isCombos ? comboTotal : rankingTotal;
  const loading = isCombos ? comboLoading : rankingLoading;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const countUnit = isCombos ? '組' : '項';

  const heading = isCombos
    ? '最常一起出現的技術組合'
    : mode === 'popular'
      ? '最多職缺要的技術'
      : '開最高薪的技術';

  const categoryOptions = isCombos ? COMBO_CATEGORY_OPTIONS : CATEGORY_OPTIONS;

  const changeMode = (value: TechsMode) => {
    if (value === mode) return;
    setMode(value);
    setPage(1);
    setCategory(prev => {
      if (value === 'combos') return prev;
      return prev === 'all' ? 'language' : prev;
    });
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
      <PageSeo
        title="技術熱度統計"
        description="台灣工程師市場技術熱度排行：語言、框架、資料庫的職缺數量與薪資中位數，掌握市場需求。"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首頁', item: `${env.siteUrl}/` },
            { '@type': 'ListItem', position: 2, name: '技術熱度', item: `${env.siteUrl}/techs` },
          ],
        }}
      />
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 技術排行 · TECH RANKING
        </div>
        <div className="flex items-end justify-between gap-4">
          <h1 className="flex items-start gap-1.5 text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
            {heading}
            <InfoHint metric={isCombos ? 'techs.combos' : 'techs.ranking'} />
          </h1>
          {!loading && (
            <span className="shrink-0 pb-1 text-sm font-semibold text-[#434653]">
              共 {totalCount.toLocaleString()} {countUnit}
            </span>
          )}
        </div>
      </div>

      <TechsFilterBar
        modeOptions={MODE_OPTIONS}
        mode={mode}
        onModeChange={value => changeMode(value as TechsMode)}
        categoryOptions={categoryOptions}
        category={category}
        onCategoryChange={changeCategory}
      />

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-[#c9e7f7] bg-white">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[#eef3f8] px-4 py-3 last:border-0"
            >
              <div className="h-4 w-8 animate-pulse rounded bg-[#d9f2ff]" />
              <div className="h-6 w-6 animate-pulse rounded bg-[#d9f2ff]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[#d9f2ff]" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded bg-[#d9f2ff]" />
            </div>
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
          <TechsTable
            mode={mode}
            page={page}
            pageSize={PAGE_SIZE}
            rankingItems={rankingItems}
            comboItems={comboItems}
          />
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
