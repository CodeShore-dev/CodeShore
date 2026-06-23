import { useNavigate } from 'react-router';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWanInt } from '../../../utils/format';
import type { RankingMode } from '../hooks/useTechRanking';

interface TechRankingCardProps {
  item: SupabaseView.MvKeywordGroupRanking;
  rank: number;
  mode: RankingMode;
}

const numField = (item: object, key: string): number =>
  (item as Record<string, number>)[key] ?? 0;

export function TechRankingCard({ item, rank, mode }: TechRankingCardProps) {
  const navigate = useNavigate();
  const isSalary = mode !== 'popular';
  const salaryType = mode === 'salary-month' ? 'month' : 'year';

  const salaryRows = [
    { label: 'PR50', value: numField(item, `${salaryType}_median_avg`) },
    { label: 'PR75', value: numField(item, `${salaryType}_pr75_avg`) },
    { label: 'PR88', value: numField(item, `${salaryType}_pr88_avg`) },
  ];

  const goJobs = () =>
    navigate(`/jobs?${new URLSearchParams({ tags: item.keyword_group })}`);

  return (
    <button
      type="button"
      className="group flex cursor-pointer flex-col rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
      onClick={goJobs}
    >
      <div className="mb-2 flex flex-col items-start gap-1">
        <div className="font-mono text-[10px] tracking-[0.15em] text-[#434653]">
          #{rank}
        </div>
        <div className="flex items-center gap-2">
          <TechIcon slugs={item.icon_slugs} label={item.label} />
          <span className="text-lg leading-tight font-black tracking-tight text-[#001f2a]">
            {item.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(item.tags ?? []).map(tag => (
            <span
              key={tag}
              className="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-1 text-[10px] font-bold text-[#434653]"
            >
              {TAG_LABEL_MAP[tag] ?? tag}
            </span>
          ))}
        </div>
      </div>

      <div className="h-full">
        {isSalary ? (
          <div className="flex flex-col gap-1.5">
            {salaryRows.map(row => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-1"
              >
                <span
                  className="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
                  style={{ fontSize: '1.125rem' }}
                >
                  {toWanInt(row.value)}
                  <span className="text-[0.875rem] font-black text-[#434653]">
                    萬
                  </span>
                </span>
                <span className="font-mono text-[10px] tracking-widest text-[#434653]">
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div
              className="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
              style={{ fontSize: '1.5rem' }}
            >
              {item.job_count.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[11px] text-[#434653]">個職缺</div>
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
  );
}
