import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { SupabaseView } from '@codeshore/data-types';

import { CATEGORY_LABEL_MAP, TAG_LABEL_MAP } from '../utils/constants';
import { TechIcon } from './TechIcon';

interface KeywordTechRankingCardListProps {
  title: string;
  items: SupabaseView.MvKeywordGroupRanking[];
  loading: boolean;
  getItems: (category: string) => void;
  moreTo?: string;
  titleHint?: ReactNode;
  renderMetric?: (
    item: SupabaseView.MvKeywordGroupRanking,
  ) => ReactNode;
}

const CARD_VISIBILITY = [
  'flex',
  'flex',
  'flex',
  'flex',
  'hidden sm:flex',
  'hidden sm:flex',
  'hidden md:flex',
  'hidden md:flex',
  'hidden lg:flex',
  'hidden lg:flex',
];
const SKELETON_VISIBILITY = [
  'block',
  'block',
  'block',
  'block',
  'hidden sm:block',
  'hidden sm:block',
  'hidden md:block',
  'hidden md:block',
  'hidden lg:block',
  'hidden lg:block',
];

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL_MAP)
  .map(([value, label]) => ({ value, label }))
  .slice(0, 4);

// Keyword/tech ranking card list (task 4.3). Vue slots are mapped to
// render-prop props: `titleHint` and `renderMetric` (with a default metric).
export function KeywordTechRankingCardList({
  title,
  items,
  loading,
  getItems,
  moreTo,
  titleHint,
  renderMetric,
}: KeywordTechRankingCardListProps) {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('language');

  // Fetch on mount and whenever the category changes (parity with the Vue
  // immediate watch). A ref keeps getItems current without re-triggering.
  const getItemsRef = useRef(getItems);
  getItemsRef.current = getItems;
  useEffect(() => {
    getItemsRef.current(selectedCategory);
  }, [selectedCategory]);

  const goJobs = (query: Record<string, string> = {}): void => {
    const qs = new URLSearchParams(query).toString();
    navigate(qs ? `/jobs?${qs}` : '/jobs');
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <div className="flex items-center gap-1.5">
            <div className="text-xs font-bold tracking-[0.18em] text-[#434653]">
              {title}
            </div>
            {titleHint}
          </div>
          {moreTo && (
            <Link
              to={moreTo}
              className="flex items-center gap-0.5 text-xs font-bold text-[#003d92] transition-colors hover:text-[#001f2a]"
            >
              更多
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '14px' }}
              >
                arrow_forward
              </span>
            </Link>
          )}
        </div>
        <div className="flex w-full flex-wrap overflow-hidden rounded-lg border border-[#c9e7f7] text-xs md:w-auto">
          {CATEGORY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`md:h-auo h-10 w-[24.9%] cursor-pointer px-3.5 py-1.5 font-bold transition-colors md:w-auto ${
                selectedCategory === opt.value
                  ? 'bg-[#003d92] text-white'
                  : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
              }`}
              onClick={() => setSelectedCategory(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {SKELETON_VISIBILITY.map((visibility, i) => (
            <div
              key={i}
              className={`h-28 animate-pulse rounded-xl bg-[#d9f2ff] ${visibility}`}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item, i) => (
            <button
              key={item.keyword_group}
              type="button"
              className={`group cursor-pointer flex-col rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                CARD_VISIBILITY[i] ?? 'hidden'
              }`}
              onClick={() => goJobs({ tags: item.keyword_group })}
            >
              <div className="mb-2 flex flex-col items-start gap-1">
                <div className="font-mono text-[10px] tracking-[0.15em] text-[#434653]">
                  #{i + 1}
                </div>
                <div className="flex items-center gap-2">
                  <TechIcon slugs={item.icon_slugs} label={item.label} />
                  <span className="text-lg leading-tight font-black tracking-tight text-[#001f2a]">
                    {item.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {(item.tags ?? []).map(tag => (
                    <span
                      key={tag}
                      className="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-1 text-[10px] font-bold text-[#434653]"
                    >
                      {TAG_LABEL_MAP[tag]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-full">
                {renderMetric ? (
                  renderMetric(item)
                ) : (
                  <>
                    <div
                      className="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
                      style={{ fontSize: '1.5rem' }}
                    >
                      {item.job_count.toLocaleString()}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#434653]">
                      個職缺
                    </div>
                  </>
                )}
              </div>
              <span className="mt-1 flex items-end justify-end gap-1 text-xs font-bold text-[#003d92]">
                前往職缺
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '14px' }}
                >
                  arrow_forward
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
