# Tech Stack — CodeShore

## Monorepo

- **Nx 21.x** 管理 monorepo，包含 `frontend`（Vue）與 `backend`（NestJS）兩個專案
- 所有依賴集中在根目錄 `package.json`（無獨立 apps 層 package.json）
- Node 22.x（engines 固定）

## Frontend

| 類型 | 技術 |
|------|------|
| 框架 | Vue 3.5，Composition API + `<script setup>` |
| 路由 | Vue Router 4.x |
| 狀態管理 | Pinia 3.x，setup-store 風格 |
| 樣式 | Tailwind CSS 4.x（PostCSS），搭配 `prettier-plugin-tailwindcss` 自動排序 |
| HTTP | Axios |
| 資料庫連線 | Supabase JS client |
| 工具 composables | VueUse (`@vueuse/core`) |
| 打包 | Vite 7.x + `@vitejs/plugin-vue` |
| 測試 | Vitest 1.x + `@vue/test-utils` |

## Backend

- **NestJS 11.x**（Express platform）
- **Supabase** PostgreSQL 作為主資料庫
- **Puppeteer + Crawlee** 爬蟲
- **LangChain / LangGraph + Anthropic SDK** 用於 AI 功能

## TypeScript

- Strict mode 開啟
- `moduleResolution: "node"`
- Monorepo 共用型別在 `@codeshore/data-types`（路徑別名）

## Code Quality

- **Prettier 3.x**：自動格式化（含 import 排序 `@trivago/prettier-plugin-sort-imports`）
- **ESLint 8.x**：`@typescript-eslint` 規則

## 開發慣例

- Frontend dev server：port 4200
- Frontend types 使用 `@codeshore/data-types`（`SupabaseView`、`SupabaseFunction` 命名空間）
