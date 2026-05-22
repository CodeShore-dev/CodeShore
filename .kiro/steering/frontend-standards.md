# Frontend Standards — CodeShore

前端開發的強制規範，所有 PR 和 AI 生成代碼均須遵守。

---

## 元件架構規則

### 1. 單一元件不超過 200 行

每個 `.vue` 檔案（含 script + template + style）**嚴格不超過 200 行**。

超過時的拆分策略（依情況選擇）：
- **UI 區塊**：抽成子元件（skeleton、CTA、chips、drawer 等）
- **可複用邏輯**：抽成 `composables/use{Purpose}.ts`
- **無狀態靜態內容**：獨立 `{Name}Section.vue` 或 `{Name}Handoff.vue`

### 2. views/ vs components/ 的邊界

| 目錄 | 放什麼 | 特徵 |
|------|--------|------|
| `views/` | 頁面級元件 | 直接出現在 `router/index.ts`；持有頁面狀態與初始化邏輯 |
| `components/` | 可複用子元件 | 不直接路由；接受 props、emit events；可獨立測試 |
| `composables/` | 可複用邏輯 | `use` 前綴；不含 template；可跨元件使用 |

### 3. 跨元件共用的規則

- **共用 UI 元件**（與 feature 無關）→ `src/components/`
- **共用 UI 狀態**（多個元件需讀寫同一狀態）→ 移至對應的 Pinia store
- **重複出現的 computed / 邏輯**（2 個以上元件）→ 抽成 composable

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

```html
<!-- 選中 -->
:class="isActive ? 'bg-[#003d92] text-white' : 'bg-white text-[#434653] hover:bg-[#f4faff]'"
```

---

## Pinia Store 規則

- 一律使用 **setup-store** 風格（`defineStore('name', () => { ... })`）
- Store 不直接依賴 router；router 操作留在 views / composables
- 頁面初始化 fetch 在 view 的 `<script setup>` 頂層呼叫，不在 store constructor
- 不在 store 裡持有純 UI 狀態（開關 dialog、sidebar open/close）

---

## Template 寫法規則

### 避免 v-for 搭配 inline 物件陣列重複三次以上

```html
<!-- ❌ 三個幾乎相同的 <button> 複製貼上 -->
<button @click="store.fetchListJobs({ preference: 'like' })">喜歡</button>
<button @click="store.fetchListJobs({ preference: 'dislike' })">不喜歡</button>
...

<!-- ✅ 用 computed 定義設定陣列 + v-for -->
<button v-for="tab in viewTabs" :key="tab.pref" @click="tab.onClick()">{{ tab.label }}</button>
```

### 條件渲染：三層以上改用 computed

```ts
// ❌ 在 template 裡的巢狀三元
store.pref === 'like' ? store.loading ? A : B : C

// ✅ 抽成 computed
const displayCount = computed(() => ...)
```

### 效能：避免在 v-for 的 :class / :style 裡做 O(N×M) 計算

```ts
// ❌ 每次 render 建立陣列再 includes
m.value.map(v => v.toLowerCase()).includes(k)

// ✅ 用 Set.has()（O(1)）
m.value.some(v => selectedKeywordsSet.has(v.toLowerCase()))
```

---

## 骨架屏 / 載入狀態規則

- 骨架屏應獨立成子元件（e.g., `JobCardSkeleton.vue`、`JobListSkeleton.vue`）
- 骨架屏色票：`bg-[#001f2a]/[0.08]` + `animate-pulse`
- 空狀態固定結構：大 icon → 標題（`font-black`）→ 說明文 → 操作按鈕

---

## 工具函式規則

- 萬元格式：使用 `utils/format.ts` 的 `toWan(n)` / `toWanInt(n)`
- 日期顯示：使用 `formatDateInfo(date, formatted)` 
- 數字千分位：使用 `formatNumber(n)`
- **不在元件內自行實作上述邏輯**

---

## 薪資範圍分隔符

統一使用 `–`（en dash），不使用 `~`（tilde）：
```
{{ toWan(min) }}–{{ toWan(max) }}
```
