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
| `@codeshore/data-utils` | Supabase 資料存取層（`api/` 子模組按表分檔）。**`scope:be`，前端不要用** |
| `@codeshore/shared-utils` | 前後端通用工具函式（如 `parseKeywordsOut`） |
| `@codeshore/supabase` | Supabase client（`getSupabaseClient()`） |

## 硬層：會讓 CI 紅的關卡

防線分四層，強度遞減：**架構 > CI/靜態分析 > rules > skill**。前兩層違規就 CI 紅；
`.kiro/steering/*.md` 與 `.claude/skills/` 是後兩層，agent 會忘，只能疊加不能當唯一防線。

**關卡只擋 PR，不擋直推 `main`。** `main` 刻意不設 branch protection（2026-10-03 決定）。
這不是漏洞，是分工：worker 的產出一律走 PR（`orca-issue-work` Step 7 固定開 PR），所以
**派工路徑全程被擋住**；繞得過去的只有你自己手動 push。鉛筆路徑刻意留著不設限。

所以下面每一句「違規就 CI 紅」都是指走 PR 的時候。

### `.github/workflows/pr-check.yml`（`on: pull_request`）

只接**在乾淨的 `main` 上已經是綠的**檢查：

| 檢查 | 指令 |
|---|---|
| 改動檔格式 | `pnpm ptr:format:check`（CI 上帶 `FORMAT_BASE=origin/main`） |
| 受影響專案的測試 | `pnpm nx affected -t test --base=origin/main --head=HEAD` |

**刻意不接 `nx lint`**：`main` 上有 62 個既有 error，接上去永遠紅，就是第二個假關卡。
要進這個 workflow 得先把它收斂到 0。在那之前 lint 的判準仍然是「數量與基準線相同」。

### 專案邊界（`project.json` 的 `tags` ＋ `.eslintrc.json` 的 `depConstraints`）

兩軸 tag，16 個 project 都有：

| 軸 | 值 | 意思 |
|---|---|---|
| `scope:` | `fe` / `be` / `shared` | 誰可以用它。`fe` 與 `be` 不能互相伸手，`shared` 不能往任一邊伸手 |
| `type:` | `app` / `service` / `data` / `util` / `types` | 依賴方向只能往下 |

`type:types`（只有 `data-types`）的允許清單是空的——純型別不依賴任何東西。

**`@codeshore/data-utils` 是 `scope:be`，不是前後端共用。** 它依賴 `service-logger`（NestJS）
與 `ai-client`（LangChain）。frontend 實際只用 `data-types` / `shared-utils` / `supabase`；
methodology 頁面提到 `data-utils` 的那兩處是**文案字串**，不是 import。

**唯一被鬆綁的一條**：`type:data` 允許依賴 `type:service`，因為 `data-utils` 在 9 處 import
`@codeshore/ai-client`——資料層裡放 LLM 呼叫。這是真實的架構落差，不是規則寫錯。收緊它要
先把 AI 呼叫搬出資料層，記在 `docs/pacer-log.md` 的排隊清單裡。

`nx.json` 的 `defaultBase` 是 `main`（曾經指向不存在的 `master`，`nx affected` 會比不到基準）。

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
