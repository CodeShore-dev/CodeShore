import { useMemo, useRef } from 'react';

import { useTechsQuery } from '../../keyword/queries';
import { techChipClass } from '../techChipStyle';

export interface TechTooltipData {
  tech: string;
  groups: {
    name: string;
    count: number;
    category: string | null;
  }[];
  x: number;
  y: number;
}

interface JobDescriptionHighlighterProps {
  htmlContent: string;
  techs: string[];
  selectedTechs: Set<string>;
  onTooltipShow: (data: TechTooltipData) => void;
  onTooltipHide: () => void;
  onTechSelect: (tech: string) => void;
}

const escapeRegExp = (str: string) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Highlights matched techs inside the JD HTML and drives the tech tooltip
// / admin tech-tagging selection (task 7.5), ported from
// JobDescriptionHighlighter.vue. Group lookups come from the shared catalog.
export function JobDescriptionHighlighter({
  htmlContent,
  techs,
  selectedTechs,
  onTooltipShow,
  onTooltipHide,
  onTechSelect,
}: JobDescriptionHighlighterProps) {
  const { data: techCatalog = [] } = useTechsQuery();
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const activeTooltipTech = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlightedContent = useMemo(() => {
    if (!htmlContent || techs.length === 0) return htmlContent;
    const regex = new RegExp(
      `(?<![\\w-])(${techs.map(escapeRegExp).join('|')})(?![\\w-]|(\\.$)\\w)`,
      'gi',
    );
    return htmlContent.replace(regex, match => {
      const isSelected = selectedTechs.has(match.toLowerCase());
      return `<span data-tech="${match.toLowerCase()}" class="${techChipClass(
        isSelected,
      )} cursor-pointer rounded-full px-3 py-1 text-sm font-bold ">${match}</span>`;
    });
  }, [htmlContent, techs, selectedTechs]);

  const buildTooltipData = (span: HTMLElement): TechTooltipData => {
    const tech = span.dataset.tech ?? '';
    const groups = techCatalog
      .filter(g =>
        g.keywords.map(k => k.toLowerCase()).includes(tech.toLowerCase()),
      )
      .map(g => ({ name: g.label, count: g.count, category: g.category }));
    const rect = span.getBoundingClientRect();
    return { tech, groups, x: rect.left + rect.width / 2, y: rect.top };
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => {
      activeTooltipTech.current = null;
      onTooltipHide();
    }, 120);
  };

  const showTooltip = (span: HTMLElement) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const data = buildTooltipData(span);
    span.addEventListener('mouseleave', scheduleHide);
    activeTooltipTech.current = data.tech;
    onTooltipShow(data);
  };

  const handleMouseOver = (event: React.MouseEvent) => {
    const span = (event.target as HTMLElement).closest(
      '[data-tech]',
    ) as HTMLElement | null;
    if (span) showTooltip(span);
  };

  const handleClick = (event: React.MouseEvent) => {
    const span = (event.target as HTMLElement).closest(
      '[data-tech]',
    ) as HTMLElement | null;
    if (!span) return;
    if (activeTooltipTech.current === span.dataset.tech) {
      activeTooltipTech.current = null;
      onTooltipHide();
    } else {
      showTooltip(span);
    }
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const tech = selection?.toString().trim();
    if (!tech || !descriptionRef.current) return;
    const range = selection?.getRangeAt(0);
    if (!range || !descriptionRef.current.contains(range.commonAncestorContainer))
      return;
    onTechSelect(tech);
  };

  return (
    <div
      ref={descriptionRef}
      className={`text-on-surface-variant text-sm leading-relaxed ${
        !highlightedContent.startsWith('<') ? 'whitespace-pre-wrap' : ''
      }`}
      onMouseOver={handleMouseOver}
      onMouseLeave={scheduleHide}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
    >
      <div dangerouslySetInnerHTML={{ __html: highlightedContent }} />
    </div>
  );
}
