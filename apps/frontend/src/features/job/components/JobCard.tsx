import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';
import { CATEGORY_LABEL_MAP } from '../../../utils/constants';
import { formatDateInfo } from '../../../utils/format';
import { useCanEdit } from '../../auth/authStore';
import { useTechsQuery } from '../../keyword/queries';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import type { useCrawlStream } from '../hooks/useCrawlStream';
import { JobCardSkeleton } from './JobCardSkeleton';
import { JobCrawlPanel } from './JobCrawlPanel';
import {
  JobDescriptionHighlighter,
  type TechTooltipData,
} from './JobDescriptionHighlighter';
import { JobHandoffCTA } from './JobHandoffCTA';
import { JobTechChips } from './JobTechChips';
import { JobTechPopover } from './JobTechPopover';

interface JobCardProps {
  job?: Partial<SupabaseView.MvJob>;
  loading: boolean;
  crawl: ReturnType<typeof useCrawlStream>;
}

// Full job detail card shown in the drawer (task 7.5), ported from JobCard.vue.
export function JobCard({ job = {}, loading, crawl }: JobCardProps) {
  const canEdit = useCanEdit();
  const { data: techs = [] } = useTechsQuery();
  const selectedTags = useKeywordFilterStore(s => s.selectedTags);

  const [keywordTooltip, setKeywordTooltip] =
    useState<TechTooltipData | null>(null);
  const [popover, setPopover] = useState<{
    keyword: string;
    x: number;
    y: number;
  } | null>(null);

  const techMapping = useMemo(
    () =>
      job.tech_mappings
        ?.filter(Boolean)
        .map(x => x.split(':'))
        .map(([key, value]) => {
          const group = techs.find(g => g.tech === key);
          return {
            key,
            label: group?.label,
            value: value.split(','),
            icon_slugs: group?.icon_slugs,
          };
        }) ?? [],
    [job.tech_mappings, techs],
  );

  const allKeywords = useMemo(
    () =>
      techMapping
        .filter(x => techs.some(y => y.tech === x.key))
        .flatMap(m => m.value)
        .sort((a, b) => b.length - a.length),
    [techMapping, techs],
  );

  const selectedKeywordsSet = useMemo(
    () =>
      new Set(
        selectedTags
          .flatMap(
            x => techMapping.find(y => y.key === x)?.value ?? [],
          )
          .map(k => k.toLowerCase()),
      ),
    [selectedTags, techMapping],
  );

  const updatedAt = useMemo(() => dayjs(job.updated_at), [job.updated_at]);
  const updatedAtInfo = useMemo(
    () =>
      formatDateInfo(
        updatedAt,
        job.updated_at ? updatedAt.format('MM/DD HH:mm') : '--/-- --:--',
      ),
    [updatedAt, job.updated_at],
  );

  const description = useMemo(() => {
    if (!job.description) return '';
    const $ = cheerio.load(job.description);
    $('*').each((_, el) => {
      (el as unknown as { attribs: Record<string, string> }).attribs = {};
    });
    return $('body').html()?.trim() ?? '';
  }, [job.description]);

  const handleKeywordSelect = (keyword: string) => {
    if (!canEdit) return;
    const range = window.getSelection()?.getRangeAt(0);
    if (!range) return;
    const rect = range.getBoundingClientRect();
    setPopover({ keyword, x: rect.left + rect.width / 2, y: rect.top });
  };

  return (
    <div className="group relative w-full">
      <div className="flex min-h-110 flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_40px_rgba(0,31,42,0.06)]">
        {loading ? (
          <JobCardSkeleton />
        ) : (
          <div className="flex grow flex-col p-4 lg:p-8">
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                {job.closed && (
                  <span className="rounded bg-[#ffdad6] px-2 py-0.5 text-[11px] font-bold text-[#93000a]">
                    已關閉
                  </span>
                )}
                <span className="text-sm font-bold text-[#434653]">
                  {job.company_name}
                </span>
              </div>
              <h3
                className={`mb-4 text-[36px] font-black leading-tight tracking-[-0.02em] wrap-break-word ${
                  job.closed ? 'text-[#001f2a]/40' : 'text-[#001f2a]'
                }`}
              >
                {job.title}
              </h3>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#434653]">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-lg">
                    location_on
                  </span>
                  {job.location}
                </span>
                <span className="flex items-center gap-1.5 font-bold text-[#9a4600]">
                  <span className="material-symbols-outlined text-lg">
                    payments
                  </span>
                  {job.salary}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  {job.id && (
                    <JobCrawlPanel jobId={job.id} crawl={crawl} />
                  )}
                  <span
                    className="flex items-center gap-1.5 font-medium"
                    title={updatedAt.format('YYYY/MM/DD HH:mm:ss')}
                  >
                    <span className="material-symbols-outlined text-lg">
                      update
                    </span>
                    {updatedAtInfo}
                  </span>
                </div>
              </div>
            </div>

            <JobTechChips
              mapping={techMapping}
              selectedTechsSet={selectedKeywordsSet}
            />
            <JobHandoffCTA detailLink={job.detail_link} />

            <div className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#434653]">
              職缺描述 · 來自原始 JD
            </div>
            <JobDescriptionHighlighter
              htmlContent={description}
              techs={allKeywords}
              selectedTechs={selectedKeywordsSet}
              onTooltipShow={setKeywordTooltip}
              onTooltipHide={() => setKeywordTooltip(null)}
              onTechSelect={handleKeywordSelect}
            />
          </div>
        )}
      </div>

      {keywordTooltip &&
        createPortal(
          <div
            className="pointer-events-auto fixed z-50"
            style={{
              left: `${keywordTooltip.x}px`,
              top: `${keywordTooltip.y - 8}px`,
              transform: 'translate(-50%, -100%)',
            }}
            onMouseLeave={() => setKeywordTooltip(null)}
          >
            <div className="min-w-52 rounded-xl border-2 border-[#c3c6d5] bg-white p-2 shadow-xl">
              {keywordTooltip.groups.length ? (
                <div className="space-y-1">
                  {keywordTooltip.groups.map(group => (
                    <div
                      key={group.name}
                      className="flex items-center gap-2 rounded-lg bg-[#003d92]/8 px-2 py-1.5"
                    >
                      <TechIcon slugs={group.icon_slugs} label={group.name} size={18} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-bold text-[#003d92]">
                          {group.name}
                        </span>
                        {group.category && (
                          <span className="w-fit rounded-full bg-current/12 px-1.5 py-px text-[9px] font-medium text-[#434653]">
                            {CATEGORY_LABEL_MAP[group.category] ??
                              group.category}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-[#434653]">
                        {group.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-1 text-sm text-[#434653]">
                  {keywordTooltip.tech}・尚無技術資料
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}

      {popover && (
        <JobTechPopover
          tech={popover.keyword}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
