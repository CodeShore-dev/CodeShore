const DARK = '#001f2a';

const SHAPES =
  'path,rect,circle,ellipse,polygon,polyline,line';
const WHITE_THRESHOLD = 248;

const cache = new Map<string, Promise<string | null>>();

export function loadProcessedIcon(
  url: string,
): Promise<string | null> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return processSvg(await res.text());
      } catch {
        return null;
      }
    })();
    cache.set(url, p);
  }
  return p;
}

export function namespaceIds(
  markup: string,
  prefix: string,
): string {
  if (!markup.includes('id=')) return markup;
  const doc = new DOMParser().parseFromString(
    markup,
    'image/svg+xml',
  );
  if (doc.querySelector('parsererror')) return markup;
  const svg = doc.querySelector('svg');
  if (!svg) return markup;

  const ids = new Set<string>();
  svg.querySelectorAll('[id]').forEach(el => {
    const id = el.getAttribute('id');
    if (id) ids.add(id);
  });
  if (!ids.size) return markup;

  const rename = (id: string) => `${prefix}-${id}`;
  const rewriteRefs = (value: string): string =>
    value.replace(
      /url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g,
      (full, ref) =>
        ids.has(ref) ? `url(#${rename(ref)})` : full,
    );

  for (const el of [
    svg,
    ...Array.from(svg.querySelectorAll('*')),
  ]) {
    if (el.tagName.toLowerCase() === 'style') {
      const css = el.textContent;
      if (css) el.textContent = rewriteRefs(css);
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      if (name === 'id' && ids.has(attr.value)) {
        el.setAttribute(name, rename(attr.value));
        continue;
      }
      if (
        (name === 'href' || name === 'xlink:href') &&
        attr.value.startsWith('#') &&
        ids.has(attr.value.slice(1))
      ) {
        el.setAttribute(name, `#${rename(attr.value.slice(1))}`);
        continue;
      }
      const next = rewriteRefs(attr.value);
      if (next !== attr.value) el.setAttribute(name, next);
    }
  }
  return new XMLSerializer().serializeToString(svg);
}

function processSvg(text: string): string | null {
  if (!text || !text.includes('<svg')) return null;
  const doc = new DOMParser().parseFromString(
    text,
    'image/svg+xml',
  );
  if (doc.querySelector('parsererror')) return null;
  const svg = doc.querySelector('svg');
  if (!svg) return null;
  sanitize(svg);
  if (isAllWhite(svg)) recolorWhites(svg);
  return new XMLSerializer().serializeToString(svg);
}

function sanitize(root: SVGSVGElement): void {
  root
    .querySelectorAll('script, foreignObject')
    .forEach(n => n.remove());
  const walk = (el: Element) => {
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(attr.name);
      else if (
        (n === 'href' || n === 'xlink:href') &&
        /^\s*(javascript:|https?:)/i.test(attr.value)
      )
        el.removeAttribute(attr.name);
    }
    Array.from(el.children).forEach(walk);
  };
  walk(root);
}

function toRgb(
  value: string,
): [number, number, number] | null {
  const s = value.trim().toLowerCase();
  if (s === 'white') return [255, 255, 255];
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m)
    return [
      parseInt(m[1][0] + m[1][0], 16),
      parseInt(m[1][1] + m[1][1], 16),
      parseInt(m[1][2] + m[1][2], 16),
    ];
  m = s.match(/^#([0-9a-f]{6})$/);
  if (m)
    return [
      parseInt(m[1].slice(0, 2), 16),
      parseInt(m[1].slice(2, 4), 16),
      parseInt(m[1].slice(4, 6), 16),
    ];
  m = s.match(/^rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map(x => parseFloat(x));
    if (p.length >= 3) return [p[0], p[1], p[2]];
  }
  return null;
}

function isWhite(value: string): boolean {
  const rgb = toRgb(value);
  return (
    !!rgb &&
    rgb[0] >= WHITE_THRESHOLD &&
    rgb[1] >= WHITE_THRESHOLD &&
    rgb[2] >= WHITE_THRESHOLD
  );
}

type ClassPaint = Map<
  string,
  { fill?: string; stroke?: string }
>;
function parseStyles(svg: SVGSVGElement): ClassPaint {
  const map: ClassPaint = new Map();
  svg.querySelectorAll('style').forEach(st => {
    const css = st.textContent ?? '';
    const re = /\.([-\w]+)\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
      const cur = map.get(m[1]) ?? {};
      const fill = m[2].match(/fill\s*:\s*([^;]+)/);
      const stroke = m[2].match(/stroke\s*:\s*([^;]+)/);
      if (fill) cur.fill = fill[1].trim();
      if (stroke) cur.stroke = stroke[1].trim();
      map.set(m[1], cur);
    }
  });
  return map;
}

function styleProp(
  el: Element,
  prop: string,
): string | undefined {
  const style = el.getAttribute('style');
  const m = style?.match(
    new RegExp(prop + '\\s*:\\s*([^;]+)'),
  );
  return m?.[1].trim();
}

function resolvePaint(
  el: Element,
  prop: 'fill' | 'stroke',
  classMap: ClassPaint,
): string {
  let node: Element | null = el;
  while (node && node.nodeType === 1) {
    const inline = styleProp(node, prop);
    if (inline) return inline;
    const cls = node.getAttribute('class');
    if (cls) {
      for (const c of cls.split(/\s+/)) {
        const r = classMap.get(c);
        if (r?.[prop]) return r[prop] as string;
      }
    }
    const attr = node.getAttribute(prop);
    if (attr) return attr;
    node = node.parentElement;
  }
  return prop === 'fill' ? 'black' : 'none';
}

function isAllWhite(svg: SVGSVGElement): boolean {
  const classMap = parseStyles(svg);
  let anyPaint = false;
  for (const el of Array.from(
    svg.querySelectorAll(SHAPES),
  )) {
    const paints: string[] = [];
    const fill = resolvePaint(el, 'fill', classMap);
    const stroke = resolvePaint(el, 'stroke', classMap);
    if (fill && fill !== 'none') paints.push(fill);
    if (stroke && stroke !== 'none') paints.push(stroke);
    if (!paints.length) continue;
    anyPaint = true;
    for (const p of paints) {
      const low = p.toLowerCase();
      if (low === 'currentcolor' || low.startsWith('url('))
        return false;
      if (!isWhite(p)) return false;
    }
  }
  return anyPaint;
}

function replaceWhite(text: string): string {
  return text.replace(
    /(fill|stroke)\s*:\s*([^;}]+)/gi,
    (full, prop, val) =>
      isWhite(val.trim()) ? `${prop}:${DARK}` : full,
  );
}

function recolorWhites(svg: SVGSVGElement): void {
  svg.querySelectorAll('style').forEach(st => {
    if (st.textContent)
      st.textContent = replaceWhite(st.textContent);
  });
  for (const el of [
    svg,
    ...Array.from(svg.querySelectorAll('*')),
  ]) {
    for (const prop of ['fill', 'stroke'] as const) {
      const a = el.getAttribute(prop);
      if (a && isWhite(a)) el.setAttribute(prop, DARK);
    }
    const style = el.getAttribute('style');
    if (style) {
      const next = replaceWhite(style);
      if (next !== style) el.setAttribute('style', next);
    }
  }
}
