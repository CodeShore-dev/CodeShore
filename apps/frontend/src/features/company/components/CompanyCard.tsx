import { useMemo } from 'react';

import { SupabaseView } from '@codeshore/data-types';

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

export function CompanyCard({
  company,
  techs,
  categoryLabelMap,
  onClick,
  onOpenDetail,
}: CompanyCardProps) {
  const { categoryMap, labelMap, countMap } = useMemo(() => {
    const categoryMap = new Map<string, string>();
    const labelMap = new Map<string, string>();
    const countMap = new Map<string, number>();
    for (const m of techs) {
      categoryMap.set(m.tech, m.category ?? '');
      labelMap.set(m.tech, m.label);
      countMap.set(m.tech, m.count);
    }
    return { categoryMap, labelMap, countMap };
  }, [techs]);

  const groupedTechs = useMemo(() => {
    const buckets = new Map<string, string[]>();
    for (const kg of company.techs) {
      const raw = categoryMap.get(kg) ?? '';
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
          (a, b) => (countMap.get(b) ?? 0) - (countMap.get(a) ?? 0),
        );
        return {
          label: categoryLabelMap[cat] ?? '其他',
          items: sorted.slice(0, 5),
          remaining: Math.max(0, sorted.length - 5),
        };
      });
  }, [company.techs, categoryMap, countMap, categoryLabelMap]);

  let host = '';
  try {
    if (company.company_link) host = new URL(company.company_link).host;
  } catch {
    host = '';
  }

  return (
    <div
      className="group flex cursor-pointer flex-col gap-3.5 rounded-[20px] bg-white p-6 shadow-[0_24px_40px_rgba(0,31,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,31,42,0.08)] active:scale-[0.98]"
      onClick={() => onClick(company.company_name)}
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
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <div
              className="leading-none font-black tracking-[-0.02em] text-[#003d92] tabular-nums"
              style={{ fontSize: '1.75rem' }}
            >
              {company.job_count}
            </div>
            <div className="mt-0.5 text-[11px] text-[#434653]">個職缺</div>
          </div>
          <button
            type="button"
            aria-label="查看公司詳情"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#434653] transition-colors hover:bg-[#e6f6ff] hover:text-[#003d92]"
            onClick={event => {
              event.stopPropagation();
              onOpenDetail(company);
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px' }}
            >
              info
            </span>
          </button>
        </div>
      </div>

      {company.techs.length > 0 && (
        <div className="space-y-2">
          {groupedTechs.map(group => (
            <div key={group.label}>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.15em] text-[#434653]">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1">
                {group.items.map(kg => (
                  <span
                    key={kg}
                    className="rounded bg-[#c9e7f7] px-2 py-0.5 text-xs font-bold text-[#434653]"
                  >
                    {labelMap.get(kg) ?? kg}
                  </span>
                ))}
                {group.remaining > 0 && (
                  <span className="px-1 py-0.5 text-xs font-bold text-[#434653]/60">
                    +{group.remaining}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="flex items-center gap-1 text-xs font-bold text-[#003d92] opacity-0 transition-opacity group-hover:opacity-100">
          查看職缺 →
        </span>
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
}
