import { memo, useMemo } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';

interface CompanyCardProps {
  company: SupabaseView.MvCompany;
  techs: SupabaseView.MvTech[];
  categoryLabelMap: Record<string, string>;
  onClick: (companyName: string) => void;
  onOpenDetail: (company: SupabaseView.MvCompany) => void;
}

const CATEGORY_PRIORITY: Record<string, number> = {
  language: 0,
  framework: 1,
  database: 2,
  library: 3,
  service: 4,
  tool: 5,
};

export const CompanyCard = memo(function CompanyCard({
  company,
  techs,
  categoryLabelMap,
  onClick,
  onOpenDetail,
}: CompanyCardProps) {
  const techMap = useMemo(() => {
    const techMap = new Map<string, SupabaseView.MvTech>();
    for (const m of techs) {
      techMap.set(m.tech, m);
    }
    return techMap;
  }, [techs]);

  const groupedTechs = useMemo(() => {
    const buckets = new Map<string, string[]>();
    for (const kg of company.techs) {
      const raw = techMap.get(kg)?.category ?? '';
      const cat = raw in CATEGORY_PRIORITY ? raw : '';
      if (!buckets.has(cat)) buckets.set(cat, []);
      buckets.get(cat)!.push(kg);
    }
    return [...buckets.entries()]
      .sort(
        ([a], [b]) =>
          (CATEGORY_PRIORITY[a] ?? 6) - (CATEGORY_PRIORITY[b] ?? 6),
      )
      .map(([cat, kgs]) => {
        const sorted = [...kgs].sort(
          (a, b) => (techMap.get(b)?.count ?? 0) - (techMap.get(a)?.count ?? 0),
        );
        return {
          label: categoryLabelMap[cat] ?? '其他',
          items: sorted.slice(0, 5),
          remaining: Math.max(0, sorted.length - 5),
        };
      });
  }, [company.techs, techMap, categoryLabelMap]);

  let host = '';
  try {
    if (company.company_link) host = new URL(company.company_link).host;
  } catch {
    host = '';
  }

  return (
    <div
      className="flex cursor-pointer flex-col gap-3.5 rounded-[20px] bg-white p-6 shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,31,42,0.08)] active:scale-[0.98]"
      onClick={() => onOpenDetail(company)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-[22px] leading-tight font-black tracking-[-0.02em] text-[#001f2a]"
            title={company.company_name}
          >
            {company.company_name}
          </h2>
          {company.company_type && (
            <span className="mt-1 block text-[11px] font-bold tracking-wider text-[#434653]">
              {company.company_type}
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div
            className="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
            style={{ fontSize: '1.75rem' }}
          >
            {company.job_count}
          </div>
          <div className="mt-0.5 text-[11px] text-[#434653]">個職缺</div>
        </div>
      </div>

      {company.techs.length > 0 && (
        <div className="space-y-2">
          {groupedTechs.map(group => (
            <div key={group.label}>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
                {group.label}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {group.items.map(kg => {
                  const meta = techMap.get(kg);
                  return (
                    <div
                      key={kg}
                      className="flex items-center gap-1.5 rounded-full border border-[#e8eaf0] bg-[#f4faff] px-2.5 py-1 text-xs font-semibold text-[#001f2a]"
                    >
                      <TechIcon
                        slugs={meta?.icon_slugs}
                        label={meta?.label ?? kg}
                        size={16}
                      />
                      {meta?.label ?? kg}
                    </div>
                  );
                })}
                {group.remaining > 0 && (
                  <span className="px-1 text-xs font-bold text-[#434653]/60">
                    +{group.remaining}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-2">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 text-xs font-bold text-[#003d92] hover:underline"
          onClick={event => {
            event.stopPropagation();
            onClick(company.company_name);
          }}
        >
          查看職缺 →
        </button>
        {company.company_link && (
          <a
            href={company.company_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[11px] text-[#434653] hover:text-[#003d92]"
            onClick={e => e.stopPropagation()}
          >
            {host}
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '12px' }}
            >
              open_in_new
            </span>
          </a>
        )}
      </div>
    </div>
  );
});
