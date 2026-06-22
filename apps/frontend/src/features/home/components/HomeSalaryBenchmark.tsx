import { useState } from 'react';

import { toWanInt } from '../../../utils/format';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useHomeData } from '../hooks/useHomeData';

const BENCHMARK_TAGS: Record<string, string> = {
  median: 'PR50',
  high: 'PR75',
  top: 'PR88',
};
const BENCHMARK_LABELS: Record<string, string> = {
  median: '中位數',
  high: '高薪',
  top: '頂薪',
};

export function HomeSalaryBenchmark() {
  const { loading, salaryBenchmarks, salaryWeightedRatios } = useHomeData();
  const [salaryUnit, setSalaryUnit] = useState<'month' | 'year'>('year');

  const ratio = salaryWeightedRatios[salaryUnit];
  const weightedRatioText = ratio ? `${ratio} 倍` : '—';

  const benchmark = salaryBenchmarks[salaryUnit];
  const activeBenchmarks = [
    { key: 'median', value: benchmark.median, position: 50 },
    { key: 'high', value: benchmark.high, position: 75 },
    { key: 'top', value: benchmark.top, position: 88 },
  ];

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] text-[#434653]">
          市場薪資行情
          <InfoHint metric="home.salaryBenchmark" />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[#c9e7f7] text-xs">
          {[
            { v: 'year', l: '年薪' },
            { v: 'month', l: '月薪' },
          ].map(opt => (
            <button
              key={opt.v}
              type="button"
              className={`cursor-pointer px-3.5 py-1.5 font-bold transition-colors ${
                salaryUnit === opt.v
                  ? 'bg-[#003d92] text-white'
                  : 'bg-[#d9f2ff] text-[#434653] hover:bg-[#ceedfd]'
              }`}
              onClick={() => setSalaryUnit(opt.v as 'month' | 'year')}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-[#f4faff] px-3 py-2">
        <span className="text-xs font-bold tracking-wide text-[#434653]">
          市場加權比率
        </span>
        <span className="font-mono text-sm font-black text-[#003d92] tabular-nums">
          {weightedRatioText}
        </span>
        <InfoHint metric="home.salaryWeightedRatio" />
      </div>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="flex animate-pulse flex-col rounded-xl bg-white p-5 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="h-4 w-8 rounded bg-[#001f2a]/8" />
                <div className="h-3 w-10 rounded bg-[#001f2a]/8" />
              </div>
              <div className="mb-3 h-14 w-32 rounded bg-[#001f2a]/8" />
              <div className="mb-1.5 h-3 w-full rounded bg-[#001f2a]/8" />
              <div className="mb-3 h-3 w-4/5 rounded bg-[#001f2a]/8" />
              <div className="mt-auto h-1.5 w-full rounded-full bg-[#001f2a]/8" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {activeBenchmarks.map(b => (
            <div
              key={b.key}
              className="flex flex-col rounded-xl bg-white p-5 shadow-[0_24px_40px_rgba(0,31,42,0.06)]"
            >
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm font-black text-[#001f2a]">
                  {BENCHMARK_LABELS[b.key]}
                </span>
                <span className="font-mono text-[10px] tracking-widest text-[#434653]">
                  {BENCHMARK_TAGS[b.key]}
                </span>
              </div>
              <div
                className="leading-[0.95] font-black tracking-[-0.03em] text-[#003d92] tabular-nums"
                style={{ fontSize: '3.25rem' }}
              >
                {toWanInt(b.value)}
                <span className="text-[1.375rem] font-black text-[#434653]">
                  萬
                </span>
              </div>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#d9f2ff]">
                <div
                  className="bg-[#003d92] transition-all duration-500"
                  style={{ width: `${b.position + 1}%` }}
                />
                <div className="w-2 bg-[#fd7700]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
