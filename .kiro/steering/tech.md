# Tech Stack — CodeShore

## Monorepo

- **Nx 21.x** 管理 monorepo，包含 `frontend`（React）與 `backend`（NestJS）兩個專案
- 所有依賴集中在根目錄 `package.json`（無獨立 apps 層 package.json）
- Node 22.x（engines 固定）

## Frontend

| 類型 | 技術 |
|------|------|
| 框架 | React 19，function components + hooks |
| 路由 | react-router 7.x（library mode，`createBrowserRouter`，純 SPA） |
| 狀態管理 | server-state → TanStack Query 5.x；UI/filter-state → Zustand 5.x |
| 樣式 | Tailwind CSS 4.x（PostCSS），搭配 `prettier-plugin-tailwindcss` 自動排序 |
| HTTP | Axios（`httpClient` + interceptors） |
| 資料庫連線 | Supabase JS client（client-side 驗證） |
| 工具 hooks | 自寫 hooks（如 `useDebouncedValue`，取代既有 VueUse） |
| 打包 | Vite 7.x + `@vitejs/plugin-react` |
| 測試 | Vitest 1.x + `@testing-library/react` + jsdom |

## Backend

- **NestJS 11.x**（Express platform）
- **Supabase** PostgreSQL 作為主資料庫
- **Puppeteer + Crawlee** 爬蟲
- **LangChain / LangGraph + Anthropic SDK** 用於 AI 功能

## TypeScript

- Strict mode 開啟
- `moduleResolution: "node"`
- Monorepo 共用套件別名：

| 別名 | 內容 |
|------|------|
| `@codeshore/data-types` | 前後端共用型別（`SupabaseTable`、`SupabaseView`、`SupabaseFunction` namespace） |
| `@codeshore/data-utils` | Supabase 資料存取層（`api/` 子模組按表分檔） |
| `@codeshore/shared-utils` | 前後端通用工具函式（如 `parseKeywordsOut`） |
| `@codeshore/supabase` | Supabase client（`getSupabaseClient()`） |

## Code Quality

- **Prettier 3.x**：自動格式化（含 import 排序 `@trivago/prettier-plugin-sort-imports`）
- **ESLint 8.x**：`@typescript-eslint` 規則

## 開發慣例

- Frontend dev server：port 4200
- Frontend types 使用 `@codeshore/data-types`（`SupabaseView`、`SupabaseFunction` 命名空間）
