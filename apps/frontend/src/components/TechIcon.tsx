import { useEffect, useId, useMemo, useState } from 'react';

import { loadProcessedIcon, namespaceIds } from '../utils/svgRecolor';

const SOURCE_URL: Record<string, (slug: string) => string> = {
  'simple-icons': slug => `https://cdn.simpleicons.org/${slug}`,
  thesvg: slug =>
    `https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/${
      slug.includes('/') ? slug : `${slug}/default`
    }.svg`,
  iconify: slug => `https://api.iconify.design/${slug}.svg`,
};

interface TechIconProps {
  slugs?: string[] | null;
  label?: string | null;
  size?: number;
  hideIfNotFound?: boolean;
}

// Tech brand icon (task 4.3). Resolves the first available icon source,
// recolors all-white icons, and namespaces ids before injecting the SVG.
// Falls back to the label initial, or nothing when hideIfNotFound is set.
export function TechIcon({
  slugs = null,
  label = '',
  size = 32,
  hideIfNotFound = true,
}: TechIconProps) {
  const rawId = useId();
  const uid = useMemo(() => `ti-${rawId.replace(/:/g, '')}`, [rawId]);

  const sources = useMemo(
    () =>
      (slugs ?? [])
        .map(entry => {
          const sep = entry.indexOf(':');
          if (sep < 0) return null;
          const builder = SOURCE_URL[entry.slice(0, sep)];
          return builder ? builder(entry.slice(sep + 1)) : null;
        })
        .filter((url): url is string => !!url),
    [slugs],
  );

  const [markup, setMarkup] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    setMarkup(null);
    setSettled(false);

    (async () => {
      for (const url of sources) {
        const svg = await loadProcessedIcon(url);
        if (!active) return;
        if (svg) {
          setMarkup(namespaceIds(svg, uid));
          setSettled(true);
          return;
        }
      }
      if (active) setSettled(true);
    })();

    return () => {
      active = false;
    };
  }, [sources, uid]);

  if (hideIfNotFound && settled && !markup) return null;

  const initial = (label?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <span
      className="techicon inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#eef3f8] bg-white"
      style={{ width: size + 8, height: size + 8 }}
    >
      {markup ? (
        <span
          className="techicon-svg inline-flex"
          style={{ width: size, height: size }}
          dangerouslySetInnerHTML={{ __html: markup }}
        />
      ) : settled ? (
        <span
          className="font-black text-[#003d92]"
          style={{ fontSize: Math.round(size * 0.6) }}
        >
          {initial}
        </span>
      ) : null}
    </span>
  );
}
