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
- **LangChain / LangGraph + Anthropic SDK** 用於 AI 功能，經 `@langchain/openrouter` 走 OpenRouter 路由（非直連單一 provider），封裝於 `@codeshore/ai-client`

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

### 已知落差：`.prettierrc` 與現存檔案不符

`apps/` 底下 578 個 `.ts` / `.tsx` 檔，用現行 `.prettierrc` 檢查有 552 個不符。這個落差
**不打算解**，兩條路都量過了：

- 改設定遷就現況：`printWidth` 降到 80 只讓不符數從 552 掉到 420，沒有解決
- 全庫重排：700 個檔、+77,409 / −84,448 行，而且 `httpClient/lifecycle/beforeCreate.ts`
  prettier 根本 parse 不過

所以改成**把關卡縮到改動檔**，全庫維持現狀：

- `pnpm ptr:format:check` 現在只檢查這個 branch 改動過的檔（`scripts/format-changed.mjs`，
  含還沒 `git add` 的新檔）。**它在乾淨的 main 上是綠的，是真關卡，可以當退化判準**
- `pnpm ptr:format` 同樣只寫改動檔
- `pnpm ptr:format:check:all` / `ptr:format:all` 才是全庫版。**不要在任何 issue 裡跑**，
  它永遠紅，而 `--write` 會重排 700 個無關檔案
- 寫新程式碼時跟周邊檔案的排版，不跟 `.prettierrc` 的 `printWidth`
- `endOfLine` 已從 `crlf` 改成 `lf`（現場多數是 LF），不必再帶 `--end-of-line lf`

## 開發慣例

- Frontend dev server：port 4200
- Frontend types 使用 `@codeshore/data-types`（`SupabaseView`、`SupabaseFunction` 命名空間）
