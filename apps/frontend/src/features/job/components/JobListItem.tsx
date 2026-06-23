import dayjs from 'dayjs';
import { type MouseEvent, useMemo } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { formatDateInfo } from '../../../utils/format';

interface JobListItemProps {
  job: SupabaseView.MvJob;
  selected: boolean;
  listViewPreference: 'like' | 'dislike' | null;
  disabled: boolean;
  onSelect: (jobId: string) => void;
  onPreference: (jobId: string, preference: 'like' | 'dislike') => void;
  innerRef?: (el: HTMLLIElement | null) => void;
}

// Single row in the job list (task 7.5), ported from JobListItem.vue.
export function JobListItem({
  job,
  selected,
  listViewPreference,
  disabled,
  onSelect,
  onPreference,
  innerRef,
}: JobListItemProps) {
  const updatedAt = useMemo(() => dayjs(job.updated_at), [job.updated_at]);
  const updatedAtInfo = useMemo(
    () =>
      formatDateInfo(
        updatedAt,
        job.updated_at ? updatedAt.format('MM/DD HH:mm') : '--/-- --:--',
      ),
    [updatedAt, job.updated_at],
  );

  const handleLike = (event: MouseEvent) => {
    event.stopPropagation();
    onPreference(job.id, 'like');
  };
  const handleDislike = (event: MouseEvent) => {
    event.stopPropagation();
    onPreference(job.id, 'dislike');
  };

  return (
    <li
      ref={innerRef}
      className={`flex min-w-0 cursor-pointer gap-4 overflow-hidden border-l-[3px] px-5 py-5 transition-all ${
        job.closed ? 'opacity-60' : ''
      } ${
        selected
          ? 'border-l-[#003d92] bg-[#003d92]/6'
          : 'border-l-transparent hover:bg-[#001f2a]/2.5'
      }`}
      onClick={() => onSelect(job.id)}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          {job.closed && (
            <span className="rounded bg-[#ffdad6] px-1.5 py-0.5 text-[9px] font-black tracking-wider text-[#93000a]">
              已關閉
            </span>
          )}
          <span className="text-[13px] font-bold text-[#434653]">
            {job.company_name}
          </span>
        </div>

        <div
          className={`mb-2.5 text-[22px] font-black leading-tight tracking-[-0.01em] wrap-break-word ${
            job.closed ? 'text-[#001f2a]/40' : 'text-[#001f2a]'
          }`}
        >
          {job.title}
        </div>

        <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#434653]">
          <span className="inline-flex items-center gap-1">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              location_on
            </span>
            {job.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              payments
            </span>
            {job.salary}
          </span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              update
            </span>
            {updatedAtInfo}
          </span>
        </div>
      </div>

      <div
        className="flex shrink-0 flex-col items-center gap-2 pt-1"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={listViewPreference === 'like' || disabled}
          className={`group relative flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-all ${
            listViewPreference === 'like'
              ? 'cursor-not-allowed opacity-40 bg-[#c9e7f7]'
              : 'cursor-pointer bg-linear-to-br from-[#003d92] to-[#1654b9] hover:shadow-md active:scale-90'
          }`}
          onClick={handleLike}
        >
          {listViewPreference !== 'like' && (
            <div className="absolute inset-0 animate-ping rounded-full bg-[#003d92] opacity-0 group-hover:opacity-20" />
          )}
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}
          >
            favorite
          </span>
        </button>

        <button
          type="button"
          disabled={listViewPreference === 'dislike' || disabled}
          className={`group flex h-9 w-9 items-center justify-center rounded-full transition-all ${
            listViewPreference === 'dislike'
              ? 'cursor-not-allowed bg-[#c9e7f7] text-[#434653] opacity-40'
              : 'cursor-pointer bg-[#c9e7f7] text-[#434653] hover:bg-[#ba1a1a] hover:text-white active:scale-90'
          }`}
          onClick={handleDislike}
        >
          <span
            className="material-symbols-outlined transition-transform group-hover:rotate-90"
            style={{ fontSize: '18px' }}
          >
            close
          </span>
        </button>

        <a
          href={job.detail_link}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#e6f6ff] text-[#003d92] hover:bg-[#003d92] hover:text-white transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '14px' }}
          >
            open_in_new
          </span>
        </a>
      </div>
    </li>
  );
}
