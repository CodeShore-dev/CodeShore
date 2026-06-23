import { useMemo, useRef } from 'react';

import { useKeywordGroupsQuery } from '../../keyword/queries';

export interface KeywordTooltipData {
  keyword: string;
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
  keywords: string[];
  selectedKeywords: Set<string>;
  onTooltipShow: (data: KeywordTooltipData) => void;
  onTooltipHide: () => void;
  onKeywordSelect: (keyword: string) => void;
}

const escapeRegExp = (str: string) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Highlights matched keywords inside the JD HTML and drives the keyword tooltip
// / admin keyword-tagging selection (task 7.5), ported from
// JobDescriptionHighlighter.vue. Group lookups come from the shared catalog.
export function JobDescriptionHighlighter({
  htmlContent,
  keywords,
  selectedKeywords,
  onTooltipShow,
  onTooltipHide,
  onKeywordSelect,
}: JobDescriptionHighlighterProps) {
  const { data: keywordGroups = [] } = useKeywordGroupsQuery();
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const activeTooltipKeyword = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlightedContent = useMemo(() => {
    if (!htmlContent || keywords.length === 0) return htmlContent;
    const regex = new RegExp(
      `(?<![\\w-])(${keywords.map(escapeRegExp).join('|')})(?![\\w-]|(\\.$)\\w)`,
      'gi',
    );
    return htmlContent.replace(regex, match => {
      const isSelected = selectedKeywords.has(match.toLowerCase());
      return `<span data-keyword="${match.toLowerCase()}" class="${
        isSelected
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container text-on-surface-variant'
      } cursor-pointer rounded-full px-3 py-1 text-sm font-bold ">${match}</span>`;
    });
  }, [htmlContent, keywords, selectedKeywords]);

  const buildTooltipData = (span: HTMLElement): KeywordTooltipData => {
    const keyword = span.dataset.keyword ?? '';
    const groups = keywordGroups
      .filter(g =>
        g.keywords.map(k => k.toLowerCase()).includes(keyword.toLowerCase()),
      )
      .map(g => ({ name: g.label, count: g.count, category: g.category }));
    const rect = span.getBoundingClientRect();
    return { keyword, groups, x: rect.left + rect.width / 2, y: rect.top };
  };

  const scheduleHide = () => {
    hideTimer.current = setTimeout(() => {
      activeTooltipKeyword.current = null;
      onTooltipHide();
    }, 120);
  };

  const showTooltip = (span: HTMLElement) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const data = buildTooltipData(span);
    span.addEventListener('mouseleave', scheduleHide);
    activeTooltipKeyword.current = data.keyword;
    onTooltipShow(data);
  };

  const handleMouseOver = (event: React.MouseEvent) => {
    const span = (event.target as HTMLElement).closest(
      '[data-keyword]',
    ) as HTMLElement | null;
    if (span) showTooltip(span);
  };

  const handleClick = (event: React.MouseEvent) => {
    const span = (event.target as HTMLElement).closest(
      '[data-keyword]',
    ) as HTMLElement | null;
    if (!span) return;
    if (activeTooltipKeyword.current === span.dataset.keyword) {
      activeTooltipKeyword.current = null;
      onTooltipHide();
    } else {
      showTooltip(span);
    }
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const keyword = selection?.toString().trim();
    if (!keyword || !descriptionRef.current) return;
    const range = selection?.getRangeAt(0);
    if (!range || !descriptionRef.current.contains(range.commonAncestorContainer))
      return;
    onKeywordSelect(keyword);
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
