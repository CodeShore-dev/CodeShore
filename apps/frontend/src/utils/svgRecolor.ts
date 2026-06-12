// 抓取圖示 SVG，消毒後判斷「整顆是否幾乎全白」，若是就把白色元素改成深色，
// 回傳可 inline 的 SVG 字串。失敗（404／非 SVG／解析錯）回傳 null。
// 結果以 url 為 key 做 module 級快取，跨所有 TechIcon 實例共用、避免重抓。

const DARK = '#001f2a'; // 全白 icon 的白色元素要轉成的深色

const SHAPES =
  'path,rect,circle,ellipse,polygon,polyline,line';
const WHITE_THRESHOLD = 248; // r/g/b 都 >= 此值視為白

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

// 移除 script / 事件屬性 / 外部參照，避免 inline 外部 SVG 造成 XSS
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

// 解析 <style> 區塊裡的 `.class { fill/stroke: ... }` 規則
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

// 解析某元素 fill/stroke 的有效顏色：inline style > class 規則 > 屬性，再往父層繼承
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

// 是否「整顆 icon 的每個會上色的元素都是白／接近白」
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
    if (!paints.length) continue; // 不上色 → 忽略
    anyPaint = true;
    for (const p of paints) {
      const low = p.toLowerCase();
      // 跟著容器色（currentColor）或漸層／彩色 → 視為非全白，不處理
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
