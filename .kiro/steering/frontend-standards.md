# Frontend Standards — CodeShore

前端開發的強制規範，所有 PR 和 AI 生成代碼均須遵守。

---

## 元件架構規則

### 1. 單一元件不超過 200 行

每個 `.tsx` 元件檔**嚴格不超過 200 行**。

超過時的拆分策略（依情況選擇）：
- **UI 區塊**：抽成子元件（skeleton、CTA、chips、drawer 等）
- **可複用邏輯**：抽成 `hooks/use{Purpose}.ts`
- **無狀態靜態內容**：獨立 `{Name}Section.tsx` 或 `{Name}Handoff.tsx`

### 2. pages/ vs components/ 的邊界

| 目錄 | 放什麼 | 特徵 |
|------|--------|------|
| `pages/` | 頁面級元件 | 直接出現在 `app/router.tsx`；持有頁面狀態與初始化邏輯 |
| `components/` | 可複用子元件 | 不直接路由；接受 props、callback props；可獨立測試 |
| `hooks/` | 可複用邏輯 | `use` 前綴；不回傳 JSX；可跨元件使用 |

### 3. 跨元件共用的規則

- **共用 UI 元件**（與 feature 無關）→ `src/components/`
- **共用 UI/filter 狀態**（多個元件需讀寫同一狀態）→ 對應的 Zustand store
- **共用 server-state**（清單/統計等）→ TanStack Query（queryKey 含篩選，取代手寫 watch 重抓）
- **重複出現的衍生邏輯**（2 個以上元件）→ 抽成 hook，純函式抽成可測試的 function

---

## 設計系統規則

### 設計 Token：硬編碼 HEX，禁用 CSS class token

**❌ 禁止**使用 CSS 自訂屬性 class 名稱（如 `bg-surface-container`、`text-on-surface`、`bg-primary`）。

**✅ 必須**直接使用硬編碼色票：

| 用途 | Tailwind class | HEX |
|------|---------------|-----|
| 主色 / 按鈕 | `bg-[#003d92]` | `#003d92` |
| 主色 hover | `bg-[#1654b9]` | `#1654b9` |
| 深色文字 / 標題 | `text-[#001f2a]` | `#001f2a` |
| 次要文字 | `text-[#434653]` | `#434653` |
| 暖橘強調 | `text-[#fd7700]` / `bg-[#fd7700]` | `#fd7700` |
| 錯誤紅 | `bg-[#ba1a1a]` | `#ba1a1a` |
| 頁面背景 | `bg-[#f4faff]` | `#f4faff` |
| 卡片背景 | `bg-white` | — |
| 淺藍 chip | `bg-[#c9e7f7]` | `#c9e7f7` |
| 淡藍背景 | `bg-[#d9f2ff]` | `#d9f2ff` |
| 邊框 | `border-[#c3c6d5]` | `#c3c6d5` |
| 分隔線 | `divide-[#001f2a]/[0.06]` | — |
| 骨架屏 | `bg-[#001f2a]/[0.08]` | — |

### 陰影系統

主要卡片陰影（統一使用）：
```
shadow-[0_24px_40px_rgba(0,31,42,0.06)]
```

### 品牌排版模式

```html
<!-- Eyebrow（欄位標籤 / 區塊標題）-->
<div class="text-[11px] font-bold tracking-[0.18em] text-[#003d92]">● 區塊名稱 · LABEL</div>

<!-- 頁面大標題 -->
<h1 class="font-black leading-tight tracking-[-0.03em] text-[#001f2a]">...</h1>

<!-- 數字展示（一定要 tabular-nums）-->
<span class="tabular-nums font-black tracking-[-0.03em] text-[#003d92]">1,234</span>
```

> **禁止**使用 `style="font-variant-numeric: tabular-nums"`，改用 Tailwind `tabular-nums` class。

### Active / Selected 按鈕狀態

```tsx
// 選中：以模板字串組 className（取代 Vue :class 三元）
className={isActive ? 'bg-[#003d92] text-white' : 'bg-white text-[#434653] hover:bg-[#f4faff]'}
```

---

## 狀態管理規則（Zustand + TanStack Query）

- **server-state**（清單/統計/計數等遠端資料）→ TanStack Query：`queryKey` 含全部篩選條件，篩選變更自動 refetch（取代手寫 `loading`/`watch`）；變更操作用 mutation + 樂觀更新 + 失效對應 query。
- **UI/filter-state**（已選關鍵字、AND/OR、排序、頁碼、抽屜開關、selectedId）→ 每 feature 一個輕量 Zustand store；以 selector hooks 訂閱（如 `useIsAuthenticated`/`useCanEdit`）。
- **URL-state**：篩選反映到 query string 用 react-router `useSearchParams`（如 `useJobUrlSync` 雙向同步）。
- store 不直接依賴 router；路由操作留在 hooks / pages。純衍生邏輯抽成可測試的 pure function（如 `deriveJobWhere`、`computeCanEdit`）。
- env 一律從 `config/env` 讀取，勿直接用 `import.meta.env`。

---

## JSX 寫法規則

### 避免幾乎相同的元素複製三次以上

```tsx
// ❌ 三個幾乎相同的 <button> 複製貼上
// ✅ 以設定陣列 + map 渲染
{viewTabs.map(tab => (
  <button key={tab.pref} onClick={tab.onClick}>{tab.label}</button>
))}
```

### 條件渲染：三層以上抽成變數 / 函式

```tsx
// ❌ JSX 裡的巢狀三元
// ✅ 在 render 前以 const / useMemo 算好
const displayCount = useMemo(() => ..., [deps]);
```

### Vue → React 對映速查

- `v-model` → 受控 `value` + `onChange`；`@click` → `onClick`；`:class` 三元 → 模板字串 `className`
- `v-html` → `dangerouslySetInnerHTML`；slot → `children` / render-prop；`<Teleport>` → `createPortal`
- 為對等遷移保留原 className（含硬編碼色票），不改樣式

### 效能：避免在 map 的 className 裡做 O(N×M) 計算

```ts
// ❌ 每次 render 建立陣列再 includes
list.map(v => v.toLowerCase()).includes(k)

// ✅ 用 Set.has()（O(1)）
selectedKeywordsSet.has(v.toLowerCase())
```

---

## 骨架屏 / 載入狀態規則

- 骨架屏應獨立成子元件（e.g., `JobCardSkeleton.tsx`、`JobListSkeleton.tsx`）
- 骨架屏色票：`bg-[#001f2a]/[0.08]` + `animate-pulse`
- 空狀態固定結構：大 icon → 標題（`font-black`）→ 說明文 → 操作按鈕

---

## 導覽 / 分頁捲動規則（強制原則）

**切換頁面（router 導覽）或切換 pagination，畫面必須自動捲動回最上方。**

這是專案級強制原則，已內建於框架層級，新功能不需也不應自行重新實作：

- **切換頁面**：`app/ScrollManager.tsx`（掛載於 `RootLayout`）統一處理（路徑變化即捲到頂部；瀏覽器上一頁/下一頁還原原位置；同路徑下的 query 變化如篩選、抽屜、分頁不觸發，避免誤跳；hash 深連結捲至區塊並保留 80px 頂部偏移）。
- **切換 pagination**：共用元件 `src/components/Pagination.tsx` 內建呼叫 `utils/scroll.ts` 的 `scrollToTop()`，任何 feature 只要使用 `<Pagination>` 即自動具備此行為。
- **新增捲動重置情境**（例如非 `<Pagination>` 的自訂分頁 UI）一律呼叫 `utils/scroll.ts` 的 `scrollToTop()`，禁止在元件內各自寫 `window.scrollTo` 重新實作。

---

## 工具函式規則

- 萬元格式：使用 `utils/format.ts` 的 `toWan(n)` / `toWanInt(n)`
- 日期顯示：使用 `formatDateInfo(date, formatted)` 
- 數字千分位：使用 `formatNumber(n)`
- 捲動回頂部：使用 `utils/scroll.ts` 的 `scrollToTop()`（見上方「導覽 / 分頁捲動規則」）
- **不在元件內自行實作上述邏輯**

---

## 薪資範圍分隔符

統一使用 `–`（en dash），不使用 `~`（tilde）：
```tsx
{toWan(min)}–{toWan(max)}
```
