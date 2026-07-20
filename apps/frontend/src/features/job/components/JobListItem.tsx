import dayjs from 'dayjs';
import { memo, type MouseEvent, useMemo } from 'react';

import { SupabaseView } from '@codeshore/data-types';

import { TechIcon } from '../../../components/TechIcon';
import { formatDateInfo } from '../../../utils/format';
import { useTechsQuery } from '../../keyword/queries';

const TECH_STACK_CATEGORIES = ['language', 'framework', 'database'];

interface TechItem {
  key?: string;
  category: string;
  label: string;
  icon_slugs?: string[] | null;
  parents?: string[] | null;
}

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
// Memoized since JobList re-renders on every selection/preference change but
// most rows' props stay referentially equal (see JobList.tsx's useCallback
// wiring for onSelect/onPreference/innerRef).
export const JobListItem = memo(function JobListItem({
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

  // `keyword_groups` (per-JD AI grouping) is the preferred source once
  // populated, but as of writing that pipeline hasn't run on any job yet --
  // every row falls back to `tech_mappings` (populated on ~90% of jobs),
  // the same fallback JobCard.tsx already uses for its detail-drawer chips.
  const { data: techs = [] } = useTechsQuery();

  const techStackChips = useMemo(() => {
    const techMap = new Map(techs.map(t => [t.tech, t]));

    // One entry per present language/framework/database tech, each keyed to
    // its `mv_tech` record (when resolvable) so framework<->language pairing
    // below can walk the `parents` FK (e.g. 'react' -> parents: ['javascript']),
    // and so each tech item can render with its own icon (CompanyCard style).
    let present: TechItem[];

    if (job.keyword_groups?.length) {
      present = job.keyword_groups
        .filter(g => TECH_STACK_CATEGORIES.includes(g.category))
        .map(g => {
          const matched = techs.find(
            t =>
              t.category === g.category &&
              g.keywords.some(k =>
                t.keywords?.map(x => x.toLowerCase()).includes(k.toLowerCase()),
              ),
          );
          return {
            key: matched?.tech,
            category: g.category,
            label: g.keywords.join(' / '),
            icon_slugs: matched?.icon_slugs,
            parents: matched?.parents,
          };
        });
    } else {
      const seenKeys = new Set<string>();
      present = [];
      for (const mapping of job.tech_mappings ?? []) {
        const key = mapping.split(':')[0];
        const meta = techMap.get(key);
        if (
          !meta?.category ||
          !TECH_STACK_CATEGORIES.includes(meta.category) ||
          seenKeys.has(key)
        ) {
          continue;
        }
        seenKeys.add(key);
        present.push({
          key,
          category: meta.category,
          label: meta.label ?? key,
          icon_slugs: meta.icon_slugs,
          parents: meta.parents,
        });
      }
    }

    const languages = present.filter(p => p.category === 'language');
    const frameworks = present.filter(p => p.category === 'framework');
    const databases = present.filter(p => p.category === 'database');

    // Pair each framework with a present parent language (e.g. Python +
    // Django); a framework with no present parent, or a language with no
    // paired framework, is shown on its own instead of merged in.
    const frameworksByLanguageKey = new Map<string, TechItem[]>();
    const standaloneFrameworks: TechItem[] = [];
    for (const fw of frameworks) {
      const parentLanguage = fw.key
        ? languages.find(l => l.key && fw.parents?.includes(l.key))
        : undefined;
      if (parentLanguage?.key) {
        const paired = frameworksByLanguageKey.get(parentLanguage.key) ?? [];
        paired.push(fw);
        frameworksByLanguageKey.set(parentLanguage.key, paired);
      } else {
        standaloneFrameworks.push(fw);
      }
    }

    // Each chip is a small ordered list of tech items -- a paired chip holds
    // [language, ...frameworks], a standalone chip holds just [tech].
    const chips: { key: string; items: TechItem[] }[] = [];
    for (const lang of languages) {
      const pairedFrameworks = lang.key
        ? frameworksByLanguageKey.get(lang.key)
        : undefined;
      chips.push({
        key: lang.key ?? lang.label,
        items: pairedFrameworks?.length ? [lang, ...pairedFrameworks] : [lang],
      });
    }
    for (const fw of standaloneFrameworks) {
      chips.push({ key: fw.key ?? fw.label, items: [fw] });
    }
    for (const db of databases) {
      chips.push({ key: db.key ?? db.label, items: [db] });
    }
    return chips;
  }, [job.keyword_groups, job.tech_mappings, techs]);

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

        {techStackChips.length > 0 && (
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {techStackChips.map(chip => (
              <div
                key={chip.key}
                data-testid="tech-chip"
                className="flex items-center gap-1.5 rounded-full border border-[#e8eaf0] bg-[#f4faff] px-2.5 py-1 text-xs font-semibold text-[#001f2a]"
              >
                {chip.items.map((item, index) => (
                  <span
                    key={item.key ?? item.label}
                    className="flex items-center gap-1"
                  >
                    {index > 0 && (
                      <span className="text-[#434653]/60">
                        {index === 1 ? '+' : '/'}
                      </span>
                    )}
                    <TechIcon
                      slugs={item.icon_slugs}
                      label={item.label}
                      size={16}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

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
});
