import { useNavigate } from 'react-router';

import { InfoHint } from '../../methodology/components/InfoHint';
import { useHomeData } from '../hooks/useHomeData';

const STAT_CARDS = [
  { label: '開放職缺', valKey: 'open' as const, query: {} as Record<string, string> },
  {
    label: '月薪職缺',
    valKey: 'month' as const,
    query: { salary: 'excluding', salaryType: 'month' },
  },
  {
    label: '年薪職缺',
    valKey: 'year' as const,
    query: { salary: 'excluding', salaryType: 'year' },
  },
];

export function HomeStatRow() {
  const { loading, jobCountText } = useHomeData();
  const navigate = useNavigate();

  const goJobs = (query: Record<string, string> = {}): void => {
    const qs = new URLSearchParams(query).toString();
    navigate(qs ? `/jobs?${qs}` : '/jobs');
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] text-[#434653]">
        職缺數量
        <InfoHint metric="home.statRow" />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="flex animate-pulse flex-col gap-2 rounded-xl bg-white p-5 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
            >
              <div className="h-3 w-16 rounded bg-[#001f2a]/8" />
              <div className="h-10 w-28 rounded bg-[#001f2a]/8" />
              <div className="h-3 w-20 rounded bg-[#001f2a]/8" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STAT_CARDS.map((card, i) => (
            <button
              key={card.label}
              type="button"
              className={`group flex cursor-pointer flex-col gap-1.5 rounded-xl p-5 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
                i === 0
                  ? 'bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]'
                  : 'bg-[#f4faff] hover:bg-[#d9f2ff]'
              }`}
              onClick={() => goJobs(card.query)}
            >
              <span className="text-xs font-bold tracking-widest text-[#434653]">
                {card.label}
              </span>
              <span
                className="leading-none font-black tracking-[-0.03em] text-[#003d92] tabular-nums"
                style={{ fontSize: '2.75rem' }}
              >
                {jobCountText[card.valKey]}
              </span>
              <div className="mt-0.5 text-[11px] text-[#434653]">個職缺</div>
              <span className="mt-1 flex items-center gap-1 self-end text-xs font-bold text-[#003d92]">
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
