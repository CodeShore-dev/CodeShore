// Compile the app's Tailwind v4 stylesheet into a static CSS file the
// design-sync converter can use as cfg.cssEntry. The source styles.css uses
// `@import 'tailwindcss'` + `@config ../tailwind.config.js`, which only the
// Tailwind pipeline can expand — the converter's CSS scrape cannot. We run it
// through @tailwindcss/postcss (scanning apps/frontend/src for used utilities)
// and prepend the Google Fonts @imports the app loads from index.html, so the
// preview cards render with the real brand fonts (Inter, Material Symbols,
// Space Grotesk, Roboto Mono) instead of browser defaults.
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const src = resolve(root, 'apps/frontend/src/styles.css');
const out = resolve(root, '.design-sync/.cache/tailwind.css');
mkdirSync(dirname(out), { recursive: true });

const FONT_IMPORTS = [
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');",
].join('\n');

const css = readFileSync(src, 'utf8');
const result = await postcss([tailwind()]).process(css, { from: src, to: out });
writeFileSync(out, FONT_IMPORTS + '\n' + result.css);
console.log(`[compile-css] wrote ${out} (${result.css.length} bytes)`);
