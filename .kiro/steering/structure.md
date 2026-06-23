# Project Structure — CodeShore

## 總體布局

```
apps/
  frontend/src/
    main.tsx        ← 進入點（createRoot + Providers）
    app/            ← 路由表（router.tsx）、Providers、守衛（ProtectedRoute/AdminRoute）、ScrollManager、RootLayout
    features/       ← 功能模組（主要代碼區）
    components/     ← 跨功能共用 UI 元件
    hooks/          ← 跨功能共用 hooks（如 useDebouncedValue）
    layout/         ← AppNavBar、AppFooter、AppMobileNav
    lib/            ← QueryClient、Supabase client
    config/         ← 集中式環境讀取（env.ts）
    utils/          ← 純工具函式（format.ts 等）
  backend/src/
    modules/        ← NestJS 模組
libs/
  data-types/           ← 前後端共用型別（@codeshore/data-types）
  data-utils/           ← Supabase 資料存取層（@codeshore/data-utils）
    api/                ← 每個 Supabase 表 / 視圖各一支 {table}.ts 檔案
  shared-utils/         ← 前後端通用工具函式（@codeshore/shared-utils）
  supabase/             ← Supabase client 初始化（@codeshore/supabase）
  service-logger/       ← NestJS logging 模組
  service-utils/        ← NestJS utilities（全域例外 filter、request wrapper）
  service-cache/        ← NestJS 快取模組（in-memory cache + interceptor）
  service-config/       ← NestJS 設定模組
  service-serve-static/ ← NestJS 靜態檔案服務
```

## Feature-First 模式

每個功能模組自包（self-contained）：

```
features/{feature}/
  pages/          ← 頁面級（routable），對應 router entry（{Name}Page.tsx）
  components/     ← 此功能的可複用 UI 子元件
  hooks/          ← 此功能的可複用邏輯（如 useJobUrlSync.ts）
  xxxFilterStore.ts ← Zustand store（UI/filter-state）
  queries.ts      ← TanStack Query 查詢（server-state；queryKey 含篩選）
  mutations.ts    ← TanStack Query mutation（樂觀更新 + 失效）
  service.ts      ← API 呼叫（async functions，框架無關，直接 import）
```

**現有 features**：`admin`、`auth`、`company`、`home`、`job`、`keyword`、`methodology`、`techs`

## 命名慣例

| 類型 | 規則 | 範例 |
|------|------|------|
| React 元件 | PascalCase `.tsx`，feature 前綴 | `JobCard.tsx`、`CompanyCard.tsx` |
| Pages | PascalCase + `Page` 後綴 | `JobPreferencePage.tsx`、`CompanyListPage.tsx` |
| Stores | `{feature}FilterStore.ts`（Zustand） | `jobFilterStore.ts` |
| Hooks | `use{Purpose}.ts` | `useJobUrlSync.ts` |
| Services | 固定 `service.ts` | `features/job/service.ts` |

## Import 慣例

- **同 feature 內**：相對路徑（`./service`、`./components/JobCard`）
- **跨 feature**：相對路徑向上（`../keyword/queries`）
- **共用元件**：相對路徑（`../../../components/Pagination`）
- **monorepo 套件**：package name（`@codeshore/data-types`）

## 共用元件 (`src/components/`)

放置與任何 feature 無關的通用 UI 元件：
- `Pagination.tsx`、`SearchInput.tsx`、`OperatorToggle.tsx`、`TechIcon.tsx` 等
- 新增共用元件時優先考慮放此處，避免各 feature 重複造輪子
