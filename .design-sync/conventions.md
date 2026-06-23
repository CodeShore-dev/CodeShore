# CodeShore UI — conventions for building with this library

A small set of React components from the CodeShore app (a Taiwan software-job
market analyzer). Tailwind CSS for styling, a Material-Design-3 style semantic
color palette, Inter for text, and Material Symbols for icons. Build with the
real components below; style your own layout glue with the same Tailwind tokens.

## Setup / wrapping

- **Styling is Tailwind utility classes.** The compiled stylesheet ships with
  the library and is already loaded — use the utility names below directly.
- **Router context.** `AppNavBar`, `AppFooter`, `AppMobileNav`, and
  `KeywordTechRankingCardList` use `react-router` (`<Link>` / `useNavigate`), so
  they must render inside a router (`<BrowserRouter>` / your app router). Wrap
  the app once at the root.
- **Icons need the Material Symbols font.** The icon glyphs (and the
  `material-symbols-outlined` class) come from the Material Symbols Outlined
  webfont, loaded by the shipped stylesheet. `TechIcon` additionally fetches
  brand logos from public CDNs at runtime and falls back to the label initial.
- **Fonts:** Inter (body/headings/labels), with Space Grotesk and Roboto Mono
  available. All served from Google Fonts by the stylesheet.

## Styling idiom — the token vocabulary

Use these **semantic** Tailwind utilities (Material-Design-3 color roles), not
raw hex. They compose as `bg-*`, `text-*`, and `border-*`:

| Family | Real utility names |
|---|---|
| Brand / accent | `primary`, `on-primary`, `primary-container`, `on-primary-container`, `secondary`, `on-secondary`, `secondary-container`, `tertiary` |
| Surfaces | `surface`, `background`, `surface-container-lowest` · `-low` · `-` · `-high` · `-highest`, `surface-variant`, `surface-bright`, `surface-dim` |
| Text on surface | `on-surface`, `on-surface-variant`, `on-background` |
| Lines / state | `outline`, `outline-variant`, `error`, `on-error`, `error-container` |
| Inverse | `inverse-surface`, `inverse-on-surface`, `inverse-primary` |

Examples seen across the library: `bg-primary text-on-primary` (active/selected
controls), `bg-surface-container text-on-surface-variant hover:bg-surface-container-high`
(default controls), `border-surface-container-highest` (input/segmented borders).

- **Radius:** `rounded` (4px), `rounded-lg`, `rounded-xl`, `rounded-full`.
- **Weight:** the UI leans on `font-bold` for control labels and `font-black`
  for emphatic numbers/headings.
- **Brand blue is `#003d92` (= `primary`) and brand orange is `#fd7700`**
  (the "Shore" in the logo). Some components use these as arbitrary hex
  (`text-[#003d92]`); prefer the `primary` token in new code.

## Where the truth lives

- Per-component API + usage: each `<Name>.d.ts` and `<Name>.prompt.md`.
- The full token palette and base styles: the shipped `styles.css` and the
  `_ds_bundle.css` it imports — read them before inventing new colors.

## One idiomatic snippet

```tsx
import { SearchInput, OperatorToggle, Pagination } from 'codeshore';

function Filters() {
  const [q, setQ] = useState('');
  const [op, setOp] = useState<'and' | 'or'>('and');
  const [page, setPage] = useState(1);
  return (
    <div className="bg-surface-container-low rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1"><SearchInput value={q} placeholder="搜尋技術…" onChange={setQ} /></div>
        <OperatorToggle value={op} onChange={setOp} />
      </div>
      <Pagination currentPage={page} totalPages={12} onPageChange={setPage} />
    </div>
  );
}
```
