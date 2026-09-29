---
name: orca-issue
description: 把 Orca 瀏覽器 Tab 的圈選內容與使用者想法轉成一張可派工的 GitHub issue，不當場改程式碼。當使用者在 Orca 圈選畫面元素、附上想法送來，或說「開 issue」「這裡要改」「記下來待辦」時使用。
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [補充說明]
---

# orca-issue Skill

## Role
你是 Orca 主 worktree 裡的收件人。使用者在 Orca 的瀏覽器 Tab 圈選畫面上的某塊 UI，附上一段想法送給你。

你的產出是**一張 GitHub issue**，不是一次修改。

## 硬規則

1. **不要改程式碼。** 不呼叫 Edit、Write、MultiEdit。不 commit。不建 branch。
2. **不要跑 build、test、dev server。** 你只做唯讀查證。
3. **一次圈選 = 一張 issue。** 使用者一次圈了多個不相關的問題時，分開開多張，每張自成一個可獨立完成的工作。
4. **不確定的事寫進「需要的資訊」，不要猜。** 後續的 worker 靠這段判斷要不要回頭問。
5. issue 內文用**繁體中文**（與 `.kiro/` 文件語言一致）。

## 執行步驟

### Step 1：整理輸入

從對話裡抓出這些欄位，缺的就標「未提供」：

- **來源 URL**：圈選當下那個 Tab 的網址（含 query string，篩選條件常在裡面）
- **圈選目標**：元素的文字、class、component 名、截圖描述、DOM 路徑，有什麼用什麼
- **使用者想法**：使用者原話。**原話要保留，不要改寫成你的說法。**
- **裝置寬度**：桌機 / 手機版（RWD 問題非常吃這個）

拿不到結構化的元素資訊時，用畫面上的可見文字當關鍵字往下查，不要停在這裡問使用者。

### Step 2：反查對應原始碼（唯讀）

用 Grep / Glob 從畫面回推檔案。順序：

1. 用圈選區的**可見中文文案**全庫搜（`apps/frontend/src`），文案通常直接寫在 component 裡
2. 用 URL 路徑對 `apps/frontend/src/app/router.tsx`，找出該頁對應的 feature
3. 進 `apps/frontend/src/features/{feature}/`，找出實際負責該塊的 component / hook
4. 涉及資料或數字時，往下追 `libs/data-utils/api/` 與 `apps/backend/src/features/`

前端功能模組現有這些：`about`、`admin`、`ai-suggestion`、`auth`、`company`、`home`、`job`、`job-filter-watchlist`、`keyword`、`keyword-curation`、`location-map`、`methodology`、`not-found`、`techs`。

找到 2-5 個高相關檔案就夠，附上 `路徑:行號`。完全找不到時，在 issue 寫「涉及檔案：待確認」，並在「需要的資訊」說明你搜過什麼關鍵字。

### Step 3：判斷這是哪一類工作

| 類型 | 判斷 | 對 issue 的影響 |
|---|---|---|
| bug | 現況與預期不符 | 要寫重現步驟 |
| enhancement | 現況正常，使用者想要更好 | 要寫目前行為與期望行為的差異 |
| 需要決策 | 有多種做法且影響 UX | 列出選項，標明要使用者先決定 |

第三類**不要**加 `orca-ready`，改加 `question`，並在最後告訴使用者這張要先討論。

### Step 4：寫草稿給使用者看

用這個結構，直接印在對話裡：

```markdown
## 現象
（一段話講清楚畫面上發生什麼事。bug 就寫「預期 X，實際 Y」。）

## 使用者想法
> （使用者原話，逐字）

## 出處
- URL：<url>
- 圈選目標：<元素描述>
- 裝置：桌機 / 手機版

## 涉及檔案
- `path/to/file.tsx:123` — （這個檔案為什麼相關）

## 重現步驟
1. …

## 需要的資訊
- （worker 動手前必須先確認的事。沒有就寫「無，可直接實作」。）

## 驗收條件
- [ ] （可驗證的結果，不是「修好」這種說法）
- [ ] 既有測試不退化

## 不在範圍內
- （明確排除的事，防 worker 擴張範圍）
```

標題格式：`[前端] 薪資篩選 slider 拖到上限會歸零`。開頭標區域（`[前端]` / `[後端]` / `[爬蟲]` / `[資料]`），主體是現象而非解法。

印完草稿，問一句「這樣開嗎？」就停下來等回覆。使用者要改就改，不要在草稿階段辯論。

### Step 5：建立 issue

使用者同意後：

```bash
gh issue create \
  --title "<標題>" \
  --label orca-ready \
  --label bug \
  --body-file <(cat <<'EOF'
<上面的內文>
EOF
)
```

label 規則：
- 一定加 `orca-ready`（這是派工腳本的觸發條件）
- 依類型加 `bug` 或 `enhancement`
- 需要先決策的加 `question`，**並且不加** `orca-ready`

### Step 6：回報

回三行就好：

1. issue 連結
2. 派工時機：`orca-dispatch` 排程每 15 分鐘抓一次；要立刻派就跑 `bash scripts/orca-dispatch.sh --issue <號碼>`
3. 下一個動作：請使用者繼續圈下一處

## 完成判準

- issue 已建立且有 `orca-ready`（或明確說明為何不加）
- 內文的「需要的資訊」與「驗收條件」都不是空的
- 本次沒有動到任何程式碼檔案
