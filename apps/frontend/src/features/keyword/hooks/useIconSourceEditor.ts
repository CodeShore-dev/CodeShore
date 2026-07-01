import { useEffect, useRef, useState } from 'react';

const ICON_SOURCES = ['thesvg', 'simple-icons', 'iconify'];

export interface IconRow {
  id: number;
  source: string;
  slug: string;
}

let rowSeq = 0;

function parseEntry(entry: string): IconRow {
  const sep = entry.indexOf(':');
  return {
    id: ++rowSeq,
    source: sep < 0 ? 'iconify' : entry.slice(0, sep),
    slug: sep < 0 ? entry : entry.slice(sep + 1),
  };
}

export function previewSlugs(row: IconRow): string[] {
  const slug = row.slug.trim();
  return slug ? [`${row.source}:${slug}`] : [];
}

// Icon-source popover state (row list, anchor position, open/close, save),
// extracted from TechCard to keep that component under the 200-line limit.
export function useIconSourceEditor(onSave: (iconSlugs: string[]) => Promise<void>) {
  const [editingIcons, setEditingIcons] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [iconRows, setIconRows] = useState<IconRow[]>([]);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const availableSources = [
    ...new Set([...ICON_SOURCES, ...iconRows.map(r => r.source)]),
  ];

  const close = (): void => setEditingIcons(false);

  useEffect(() => {
    if (!editingIcons) return;
    const onOutside = (e: MouseEvent): void => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKeydown);
    };
  }, [editingIcons]);

  const open = (e: React.MouseEvent, currentIconSlugs: string[] | null): void => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchor({ x: r.left + r.width / 2, y: r.top });
    setIconRows((currentIconSlugs ?? []).map(parseEntry));
    setEditingIcons(true);
  };

  const moveIcon = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= iconRows.length) return;
    const next = [...iconRows];
    [next[i], next[j]] = [next[j], next[i]];
    setIconRows(next);
  };

  const addIconRow = (): void =>
    setIconRows(rows => [...rows, { id: ++rowSeq, source: 'iconify', slug: '' }]);

  const removeIconRow = (i: number): void =>
    setIconRows(rows => rows.filter((_, idx) => idx !== i));

  const updateRow = (i: number, patch: Partial<IconRow>): void =>
    setIconRows(rows => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async (): Promise<void> => {
    const composed = iconRows
      .filter(r => r.slug.trim())
      .map(r => `${r.source}:${r.slug.trim()}`);
    await onSave(composed);
    close();
  };

  return {
    editingIcons,
    anchor,
    iconRows,
    popupRef,
    availableSources,
    open,
    close,
    moveIcon,
    addIconRow,
    removeIconRow,
    updateRow,
    save,
  };
}
