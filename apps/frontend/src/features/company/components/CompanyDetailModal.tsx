import { useMemo } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { Modal } from '../../../components/Modal';
import { TechIcon } from '../../../components/TechIcon';
import { useCompanyTechStatsQuery } from '../queries';

export interface CompanyDetailModalProps {
  company: SupabaseView.MvCompany | null;
  techs: SupabaseView.MvTech[];
  categoryLabelMap: Record<string, string>;
  onClose: () => void;
  onGoToJobs: (companyName: string) => void;
}

const CATEGORY_PRIORITY: Record<string, number> = {
  language: 0,
  framework: 1,
  database: 2,
  library: 3,
  service: 4,
  tool: 5,
};

// Company detail view (task 6.1): shared Modal shell wrapping the company's
// full, untruncated technology list (reusing CompanyCard's groupedTechs
// bucketing/sorting logic minus the .slice(0, 5) cap) and basic info block.
export function CompanyDetailModal({
  company,
  techs,
  categoryLabelMap,
  onClose,
  onGoToJobs,
}: CompanyDetailModalProps) {
  const { data: techStats } = useCompanyTechStatsQuery(company?.company_id);

  const techMap = useMemo(() => {
    const map = new Map<string, SupabaseView.MvTech>();
    for (const t of techs) {
      map.set(t.tech, t);
    }
    return map;
  }, [techs]);

  const groupedTechs = useMemo(() => {
    if (!company) return [];
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
      .map(([cat, kgs]) => ({
        label: categoryLabelMap[cat] ?? '其他',
        items: [...kgs].sort(
          (a, b) => (techMap.get(b)?.count ?? 0) - (techMap.get(a)?.count ?? 0),
        ),
      }));
  }, [company, techMap, categoryLabelMap]);

  return (
    <Modal
      open={!!company}
      title={company?.company_name ?? ''}
      onClose={onClose}
    >
      {company && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            {company.company_type && (
              <span className="text-[11px] font-bold tracking-wider text-[#434653]">
                {company.company_type}
              </span>
            )}
            {company.company_link && (
              <a
                href={company.company_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1 text-sm text-[#003d92] hover:underline"
              >
                {company.company_link}
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '14px' }}
                >
                  open_in_new
                </span>
              </a>
            )}
            <button
              type="button"
              className="mt-1 flex w-fit items-center gap-1 text-xs font-bold text-[#003d92] hover:underline"
              onClick={() => onGoToJobs(company.company_name)}
            >
              查看職缺 →
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {groupedTechs.map(group => (
              <div key={group.label} className="flex flex-col gap-2">
                <div className="text-[11px] font-bold tracking-[0.15em] text-[#434653]">
                  {group.label}
                </div>
                <div className="flex flex-wrap gap-2">
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
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-bold tracking-[0.15em] text-[#434653]">
              技術佔比
            </div>
            {company.job_count === 0 ? (
              <p className="text-sm text-[#434653]">目前沒有職缺</p>
            ) : (
              <div className="flex flex-col gap-1">
                {techStats.map(stat => {
                  const meta = techMap.get(stat.tech);
                  const percentage = Math.round(
                    (stat.job_count / company.job_count) * 100,
                  );
                  return (
                    <div
                      key={stat.tech}
                      data-testid="tech-stat-row"
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#e8eaf0] px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-[#001f2a]">
                        <TechIcon
                          slugs={meta?.icon_slugs}
                          label={meta?.label ?? stat.tech}
                          size={16}
                        />
                        {meta?.label ?? stat.tech}
                      </div>
                      <div className="flex items-center gap-2 text-[#434653]">
                        <span>{stat.job_count}</span>
                        <span className="font-bold">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
