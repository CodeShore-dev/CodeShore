# design-sync notes — CodeShore

Repo-specific gotchas for syncing the CodeShore UI to claude.ai/design.

## Source shape
- This is an **application** (Nx monorepo: `apps/frontend` React + `apps/backend` NestJS), **not** a packaged design-system library. There is no component `dist/` and no Storybook.
- Synced via the **package shape in synth/entry mode**: a committed entry file `.design-sync/entry.tsx` re-exports the scoped components; `cfg.entry` points the converter at it. Walk-up from `.design-sync/` lands on the repo-root `package.json` (name `codeshore`), so **PKG_DIR = repo root** and `cfg.srcDir = apps/frontend/src`.
- Scope (chosen by user, 2026-06-23): the reusable components under `apps/frontend/src/components` + `apps/frontend/src/layout`. `features/**` screens are intentionally excluded (app/data-coupled).

## CSS — Tailwind v4 (must pre-compile)
- `apps/frontend/src/styles.css` uses `@import 'tailwindcss'` + `@config "../tailwind.config.js"` (Tailwind v4). The converter's CSS scrape cannot expand this.
- `cfg.buildCmd = node .design-sync/compile-css.mjs` compiles it via `@tailwindcss/postcss` (scans `apps/frontend/src`) into `.design-sync/.cache/tailwind.css`, which `cfg.cssEntry` points at. **Re-run buildCmd before the converter on every sync.**
- The compile script prepends the app's Google-Fonts `@import`s so previews load the real brand fonts.

## Fonts (runtime / remote)
- Inter, Space Grotesk, Roboto Mono, Material Symbols Outlined are all **Google-Fonts-served at runtime** (via `<link>` in `apps/frontend/index.html`), never shipped. Loaded in previews via the `@import`s prepended by `compile-css.mjs` → expect `[FONT_REMOTE]` (informational). `cfg.runtimeFontPrefixes` suppresses `[FONT_MISSING]` for them.
- `.material-symbols-outlined` helper class comes from Google's Material Symbols stylesheet (the `@import`), not from styles.css (which only sets `font-variation-settings`).

## Bundle init landmine — supabase (must keep)
- `apps/frontend/src/lib/supabase.ts` calls `createClient(env.supabaseUrl, …)` at module top-level; with no Vite env the real client throws "supabaseUrl is required" and **crashes the whole IIFE at init** (reached via `AppNavBar` → `authStore` → `lib/supabase`).
- Fixed by redirecting `@supabase/supabase-js` to `.design-sync/shims/supabase.ts` (a no-throw stub) via `cfg.tsconfig` = `.design-sync/tsconfig.bundle.json` `paths`. Also drops ~700KB of supabase from the bundle (873KB → 137KB).
- **Gotcha:** the converter's tsconfig-paths plugin strips `//` comments before `JSON.parse`. A `"//": "…"` JSON key in `tsconfig.bundle.json` breaks the parse silently → no aliases applied → real supabase bundled again. Keep that tsconfig comment-free.

## .d.ts contracts
- App/synth mode: the ts-morph project loads `.d.ts`, not the `.tsx` prop interfaces, so auto-extraction returns `[key: string]: unknown` for every component. All 8 contracts are hand-written in `cfg.dtsPropsFor` (keep them in sync with the sources).

## AppMobileNav preview
- Ships `position: fixed; bottom: 0` + `md:hidden`. A fixed child escapes the capture box (blank PNG), and `package-validate`'s render check does NOT honor `cfg.overrides.<Name>.viewport`, so at the desktop-width capture `md:hidden` hides it. Preview forces it visible+in-flow with a scoped `<style>` (`position:static !important; display:flex !important`). Don't remove that.

## Providers / context
- `cfg.provider = MemoryRouter` (re-exported from `react-router` in `entry.tsx`). Needed by `KeywordTechRankingCardList`, `AppNavBar`, `AppFooter`, `AppMobileNav` (they use `Link`/`useNavigate`).
- `AppNavBar` reads a zustand auth store (`features/auth/authStore`) — global, renders with default (logged-out) state.
- `import.meta.env.*` (read by `apps/frontend/src/config/env.ts`, imported by `AppFooter`) is satisfied by the converter's synthetic `import.meta.env` define — no throw; falls back to defaults (appVersion `0.0.0-local`).

## Component-specific
- `TechIcon` fetches brand icons from remote CDNs (simpleicons / thesvg / iconify). Statically it shows the **fallback initial** (set `hideIfNotFound={false}` + a `label` in previews so the card isn't empty).
- `KeywordTechRankingCardList` imports `SupabaseView` from `@codeshore/data-types` **type-only** (esbuild drops it). Needs realistic `items` data + `getItems`/`renderMetric` props in its preview.

## Re-sync risks
- Tailwind utilities are scanned from `apps/frontend/src` at compile time — a component using a class no longer present elsewhere could lose its utility if the scan globs change. The compile scans the whole `src`, so this is low risk.
- Fonts depend on Google Fonts CDN reachability at preview-render time; offline → fallback fonts (non-blocking).
- Preview fidelity for the 3 layout components is bounded by their app-coupling (auth store, env, nav-links hook); they render but are app-shell, not pure primitives.
