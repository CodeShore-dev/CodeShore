import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { TechIcon } from '../../../components/TechIcon';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWan } from '../../../utils/format';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useTechComboStats } from '../hooks/useTechComboStats';

interface HomeHotCombosProps {
  tech: string;
}

export function HomeHotCombos({ tech }: HomeHotCombosProps) {
  const { items, getItems, loading } = useTechComboStats();
  const navigate = useNavigate();

  useEffect(() => {
    getItems({
      where: { tech1: { eq: tech }, cat2: { neq: 'language' } },
    });
  }, [tech, getItems]);

  const goJobs = (query: Record<string, string> = {}): void => {
    const qs = new URLSearchParams(query).toString();
    navigate(qs ? `/jobs?${qs}` : '/jobs');
  };

  const topCombo = items[0];
  const smallCombos = items.slice(1, 5);
  const techLabel = topCombo?.tech1_label ?? tech;

  if (!loading && items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-1.5 text-base font-black text-[#001f2a]">
        <span>
          與 <span className="text-[#003d92]">{techLabel}</span> 語言最常同時出現的技術組合
        </span>
        <InfoHint metric="home.hotCombos" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-1 h-60 animate-pulse rounded-xl bg-[#d9f2ff] sm:col-span-2 md:col-span-1 md:row-span-2 md:h-72" />
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl bg-[#d9f2ff]"
            />
          ))}
        </div>
      ) : topCombo ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <button
            type="button"
            className="group col-span-1 flex min-w-0 cursor-pointer flex-col justify-between rounded-xl bg-[#001f2a] p-6 text-left text-white transition-all hover:opacity-95 active:scale-[0.98] sm:col-span-2 md:col-span-1 md:row-span-2"
            style={{ minHeight: 'clamp(200px, 50vw, 280px)' }}
            onClick={() =>
              goJobs({ tags: `${topCombo.tech1},${topCombo.tech2}` })
            }
          >
            <div>
              <div className="mb-4 flex items-center justify-between font-mono text-[11px] tracking-[0.15em] text-white/50">
                <span>#1</span>
                <span className="flex items-center gap-1 font-sans font-bold tracking-normal text-[#fd7700]">
                  前往職缺
                  <span
                    className="material-symbols-outlined transition-transform group-hover:translate-x-0.5"
                    style={{ fontSize: '14px' }}
                  >
                    arrow_forward
                  </span>
                </span>
              </div>
              <div
                className="flex flex-col gap-2 leading-none font-black tracking-[-0.03em]"
                style={{ fontSize: 'clamp(1.75rem, 7vw, 3.25rem)' }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <TechIcon
                    slugs={topCombo.tech1_icons}
                    label={topCombo.tech1_label}
                  />
                  <span className="min-w-0 wrap-break-word">
                    {topCombo.tech1_label}
                  </span>
                </div>
                <span className="text-[#fd7700]">+</span>
                <div className="flex min-w-0 items-center gap-2">
                  <TechIcon
                    slugs={topCombo.tech2_icons}
                    label={topCombo.tech2_label}
                  />
                  <span className="min-w-0 wrap-break-word">
                    {topCombo.tech2_label}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(topCombo.tech2_tags ?? []).map(tag => (
                  <span
                    key={tag}
                    className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70"
                  >
                    {TAG_LABEL_MAP[tag] ?? tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <div
                  className="leading-none font-black tracking-[-0.02em] text-[#fd7700] tabular-nums"
                  style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)' }}
                >
                  {topCombo.job_count.toLocaleString()}
                </div>
                <div className="mt-0.5 text-[11px] text-white/50">個職缺</div>
              </div>
              <div>
                <div className="text-right">
                  <div className="text-xl font-black tabular-nums">
                    {toWan(topCombo.median_min_year)}–
                    {toWan(topCombo.median_max_year)}
                  </div>
                  <div className="text-[11px] text-white/50">年薪</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black tabular-nums">
                    {toWan(topCombo.median_min_month)}–
                    {toWan(topCombo.median_max_month)}
                  </div>
                  <div className="text-[11px] text-white/50">月薪</div>
                </div>
              </div>
            </div>
          </button>

          {smallCombos.map((combo, i) => (
            <button
              key={`${combo.tech1}+${combo.tech2}`}
              type="button"
              className="group flex min-w-0 cursor-pointer flex-col justify-between rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ minHeight: '130px' }}
              onClick={() =>
                goJobs({ tags: `${combo.tech1},${combo.tech2}` })
              }
            >
              <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-[#434653]">
                <span>#{i + 2}</span>
                <span className="flex items-center gap-0.5 font-sans font-bold tracking-normal text-[#003d92]">
                  前往職缺
                  <span
                    className="material-symbols-outlined transition-transform group-hover:translate-x-0.5"
                    style={{ fontSize: '13px' }}
                  >
                    arrow_forward
                  </span>
                </span>
              </div>
              <div
                className="mt-2 flex flex-col gap-1 leading-tight font-black tracking-[-0.02em] text-[#001f2a]"
                style={{ fontSize: '1.375rem' }}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <TechIcon
                    slugs={combo.tech1_icons}
                    label={combo.tech1_label}
                  />
                  <span className="min-w-0 wrap-break-word">
                    {combo.tech1_label}
                  </span>
                </div>
                <span className="px-2 text-[#fd7700]">+</span>
                <div className="flex min-w-0 items-center gap-1.5">
                  <TechIcon
                    slugs={combo.tech2_icons}
                    label={combo.tech2_label}
                  />
                  <span className="min-w-0 wrap-break-word">
                    {combo.tech2_label}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(combo.tech2_tags ?? []).map(tag => (
                  <span
                    key={tag}
                    className="shrink-0 rounded bg-[#d9f2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#434653]"
                  >
                    {TAG_LABEL_MAP[tag] ?? tag}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div
                    className="leading-none font-black text-[#003d92] tabular-nums"
                    style={{ fontSize: '1.375rem' }}
                  >
                    {combo.job_count.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#434653]">個職缺</div>
                </div>
                <div className="text-[11px]">
                  <div className="text-right">
                    <div className="font-bold text-[#434653] tabular-nums">
                      {toWan(combo.median_min_year)}–
                      {toWan(combo.median_max_year)}
                    </div>
                    <div className="text-[11px]">年薪</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#434653] tabular-nums">
                      {toWan(combo.median_min_month)}–
                      {toWan(combo.median_max_month)}
                    </div>
                    <div className="text-[11px]">月薪</div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
