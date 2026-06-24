import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Pagination } from '../../../components/Pagination';
import { TechIcon } from '../../../components/TechIcon';
import { TAG_LABEL_MAP } from '../../../utils/constants';
import { toWan } from '../../../utils/format';
import { InfoHint } from '../../methodology/components/InfoHint';
import { useTechCombos } from '../hooks/useTechCombos';

const PAGE_SIZE = 24;

export function TechCombosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    loadingLanguages,
    languages,
    loadLanguages,
    loading,
    items,
    totalCount,
    fetchPage,
  } = useTechCombos();

  const [selectedTech, setSelectedTech] = useState('');
  const [page, setPage] = useState(1);
  const initialized = useRef(false);

  useEffect(() => {
    loadLanguages();
  }, [loadLanguages]);

  // Pick the initial language once the chips have loaded (from ?tech or first).
  useEffect(() => {
    if (initialized.current || languages.length === 0) return;
    initialized.current = true;
    const queryTech = searchParams.get('tech');
    const initial =
      queryTech && languages.some(l => l.tech === queryTech)
        ? queryTech
        : languages[0]?.tech;
    if (initial) setSelectedTech(initial);
  }, [languages, searchParams]);

  useEffect(() => {
    if (!selectedTech) return;
    fetchPage({ tech: selectedTech, page, pageSize: PAGE_SIZE });
  }, [selectedTech, page, fetchPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedLabel =
    languages.find(l => l.tech === selectedTech)?.label ??
    selectedTech;

  const setTech = (value: string) => {
    if (value === selectedTech) return;
    setSelectedTech(value);
    setPage(1);
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('tech', value);
        return next;
      },
      { replace: true },
    );
  };

  const goJobs = (tech1: string, tech2: string) =>
    navigate(`/jobs?${new URLSearchParams({ tags: `${tech1},${tech2}` })}`);

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold tracking-[0.18em] text-[#003d92]">
          ● 技術組合 · TECH COMBOS
        </div>
        <div className="flex items-end justify-between gap-4">
          <h1 className="flex items-start gap-1.5 text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-[#001f2a]">
            <span>
              最常一起出現的<br className="sm:hidden" />技術組合
            </span>
            <InfoHint metric="techs.combos" />
          </h1>
          {selectedTech && !loading && (
            <span className="shrink-0 pb-1 text-sm font-semibold text-[#434653]">
              共 {totalCount.toLocaleString()} 組
            </span>
          )}
        </div>
      </div>

      {loadingLanguages ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="h-9 w-24 animate-pulse rounded-full bg-[#d9f2ff]"
            />
          ))}
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap gap-2">
          {languages.map(lang => (
            <button
              key={lang.tech}
              type="button"
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
                selectedTech === lang.tech
                  ? 'border-[#003d92] bg-[#003d92] text-white'
                  : 'border-[#c9e7f7] bg-white text-[#434653] hover:bg-[#d9f2ff]'
              }`}
              onClick={() => setTech(lang.tech)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}

      {selectedTech && (
        <div className="mb-4 text-base font-black text-[#001f2a]">
          與 <span className="text-[#003d92]">{selectedLabel}</span> 最常同時出現的技術
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl bg-[#d9f2ff]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center">
          <div className="mb-3 text-5xl font-black text-[#001f2a]/10">0</div>
          <p className="text-sm font-bold text-[#434653]">
            找不到這個語言的技術組合
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((combo, i) => (
              <button
                key={`${combo.tech1}+${combo.tech2}`}
                type="button"
                className="group flex min-w-0 cursor-pointer flex-col justify-between rounded-xl bg-white p-4 text-left shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                onClick={() => goJobs(combo.tech1, combo.tech2)}
              >
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-[#434653]">
                  <span>#{(page - 1) * PAGE_SIZE + i + 1}</span>
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
