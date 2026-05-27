# Project Structure — CodeShore

## 總體布局

```
apps/
  frontend/src/
    features/       ← 功能模組（主要代碼區）
    components/     ← 跨功能共用 UI 元件
    composables/    ← 跨功能共用 composables（目前空）
    layout/         ← AppNavBar、AppFooter、AppMobileNav
    utils/          ← 純工具函式（format.ts 等）
    router/         ← Vue Router 路由定義
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
  views/          ← 頁面級（routable），對應 router entry
  components/     ← 此功能的可複用 UI 子元件
  composables/    ← 此功能的可複用邏輯（如 useJobUrlSync.ts）
  useXxxStore.ts  ← Pinia store（setup-store 風格）
  service.ts      ← API 呼叫（async functions，直接 import）
```

**現有 features**：`auth`、`company`、`home`、`job`、`keyword`

## 命名慣例

| 類型 | 規則 | 範例 |
|------|------|------|
| Vue 元件 | PascalCase，feature 前綴 | `JobCard.vue`、`CompanyCard.vue` |
| Views | PascalCase，語意化 | `JobPreference.vue`、`CompanyList.vue` |
| Stores | `use{Feature}Store.ts` | `useJobStore.ts` |
| Composables | `use{Purpose}.ts` | `useJobUrlSync.ts` |
| Services | 固定 `service.ts` | `features/job/service.ts` |

## Import 慣例

- **同 feature 內**：相對路徑（`./service`、`./components/JobCard.vue`）
- **跨 feature**：相對路徑向上（`../keyword/useKeywordStore`）
- **共用元件**：相對路徑（`../../../components/Pagination.vue`）
- **monorepo 套件**：package name（`@codeshore/data-types`）

## 共用元件 (`src/components/`)

放置與任何 feature 無關的通用 UI 元件：
- `Pagination.vue`、`SearchInput.vue`、`OperatorToggle.vue` 等
- 新增共用元件時優先考慮放此處，避免各 feature 重複造輪子
