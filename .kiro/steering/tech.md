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

`apps/` 底下 578 個 `.ts` / `.tsx` 檔，用現行 `.prettierrc` 檢查有 552 個不符。主因是
`printWidth: 120`，但現有程式碼排在約 80 欄；`endOfLine: "crlf"` 也與多數 LF 檔案相反
（改用 `lf` 檢查仍有 457 個不符）。

因此：

- 全庫 `pnpm ptr:format:check` 在 `main` 上就是紅的，**不是退化判準**，不要拿它當關卡
- 不要跑 `pnpm ptr:format` 或 `prettier --write .`。那會重排數百個無關檔案
- 只檢查自己這次改動的檔案。寫新程式碼時跟周邊檔案的排版，不跟 `.prettierrc` 的 `printWidth`
- 要真正解掉這個落差是獨立決定（全庫重排，或改設定遷就現況），不在任一張 issue 的範圍內

## 開發慣例

- Frontend dev server：port 4200
- Frontend types 使用 `@codeshore/data-types`（`SupabaseView`、`SupabaseFunction` 命名空間）
