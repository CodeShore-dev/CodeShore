import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { SupabaseView } from '@codeshore/data-types';

import { formatDateInfo } from '../../../utils/format';
import { useCanEdit } from '../../auth/authStore';
import { useKeywordGroupsQuery } from '../../keyword/queries';
import { useKeywordFilterStore } from '../../keyword/keywordFilterStore';
import type { useCrawlStream } from '../hooks/useCrawlStream';
import { JobCardSkeleton } from './JobCardSkeleton';
import { JobCrawlPanel } from './JobCrawlPanel';
import {
  JobDescriptionHighlighter,
  type KeywordTooltipData,
} from './JobDescriptionHighlighter';
import { JobHandoffCTA } from './JobHandoffCTA';
import { JobKeywordChips } from './JobKeywordChips';
import { JobKeywordPopover } from './JobKeywordPopover';

interface JobCardProps {
  job?: Partial<SupabaseView.MvJob>;
  loading: boolean;
  crawl: ReturnType<typeof useCrawlStream>;
}

// Full job detail card shown in the drawer (task 7.5), ported from JobCard.vue.
export function JobCard({ job = {}, loading, crawl }: JobCardProps) {
  const canEdit = useCanEdit();
  const { data: keywordGroups = [] } = useKeywordGroupsQuery();
  const selectedTags = useKeywordFilterStore(s => s.selectedTags);

  const [keywordTooltip, setKeywordTooltip] =
    useState<KeywordTooltipData | null>(null);
  const [popover, setPopover] = useState<{
    keyword: string;
    x: number;
    y: number;
  } | null>(null);

  const keywordGroupMapping = useMemo(
    () =>
      job.keyword_group_mappings
        ?.filter(Boolean)
        .map(x => x.split(':'))
        .map(([key, value]) => {
          const group = keywordGroups.find(g => g.keyword_group === key);
          return { key, label: group?.label, value: value.split(',') };
        }) ?? [],
    [job.keyword_group_mappings, keywordGroups],
  );

  const allKeywords = useMemo(
    () =>
      keywordGroupMapping
        .filter(x => keywordGroups.some(y => y.keyword_group === x.key))
        .flatMap(m => m.value)
        .sort((a, b) => b.length - a.length),
    [keywordGroupMapping, keywordGroups],
  );

  const selectedKeywordsSet = useMemo(
    () =>
      new Set(
        selectedTags
          .flatMap(
            x => keywordGroupMapping.find(y => y.key === x)?.value ?? [],
          )
          .map(k => k.toLowerCase()),
      ),
    [selectedTags, keywordGroupMapping],
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

            <JobKeywordChips
              mapping={keywordGroupMapping}
              selectedKeywordsSet={selectedKeywordsSet}
            />
            <JobHandoffCTA detailLink={job.detail_link} />

            <div className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[#434653]">
              職缺描述 · 來自原始 JD
            </div>
            <JobDescriptionHighlighter
              htmlContent={description}
              keywords={allKeywords}
              selectedKeywords={selectedKeywordsSet}
              onTooltipShow={setKeywordTooltip}
              onTooltipHide={() => setKeywordTooltip(null)}
              onKeywordSelect={handleKeywordSelect}
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
            <div className="min-w-44 rounded-xl border-2 border-[#c3c6d5] bg-white p-3 shadow-xl">
              <p className="mb-2 text-sm font-black tracking-widest text-[#003d92]">
                {keywordTooltip.keyword}
              </p>
              {keywordTooltip.groups.length ? (
                <div className="space-y-1.5">
                  {keywordTooltip.groups.map(group => (
                    <div
                      key={group.name}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-bold text-[#001f2a]">
                          {group.name}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {group.category && (
                            <span className="rounded bg-[#f4faff] px-1.5 py-0.5 text-[9px] font-bold text-[#434653]">
                              {group.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-[#434653]">
                        {group.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#434653]">尚無群組資料</p>
              )}
            </div>
          </div>,
          document.body,
        )}

      {popover && (
        <JobKeywordPopover
          keyword={popover.keyword}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
