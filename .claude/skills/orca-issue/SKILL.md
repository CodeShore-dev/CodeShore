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

## 最重要的一條：派 subagent，主 session 不要卡住

使用者會**連續**圈選並送新的要求進來。主 session 必須隨時能接下一張，所以反查原始碼與寫 issue 一律派給 subagent。

收到圈選後，立刻用 Agent 工具派一個 `general-purpose` subagent，把下面這些**原封不動**交給它：

- 圈選的完整瀏覽器 context（URL、selector、文字、React 樹、DOM 路徑、裝置寬度）
- 使用者的原話
- 這份 SKILL.md 的路徑：`.claude/skills/orca-issue/SKILL.md`，要它自己讀完並照著做

主 session 只做三件事：

1. 派出 subagent
2. 回一行告訴使用者「已派 subagent 處理，可以繼續圈下一處」
3. subagent 回報後，把 issue 連結與派工狀態轉給使用者

**不要**在主 session 裡跑 Grep、Read、`gh issue create`。那些是 subagent 的工作。
**不要**等 subagent 回來才回應使用者。派完就回話。

同時有多張圈選時，一張一個 subagent，平行跑。

## 硬規則

1. **不要改程式碼。** 不呼叫 Edit、Write、MultiEdit。不 commit。不建 branch。
2. **不要跑 build、test、dev server。** 你只做唯讀查證。
3. **一次圈選 = 一張 issue。** 使用者一次圈了多個不相關的問題時，分開開多張，每張自成一個可獨立完成的工作。
4. **不確定的事寫進「需要的資訊」，不要猜。** 後續的 worker 靠這段判斷要不要回頭問。
5. issue 內文用**繁體中文**（與 `.kiro/` 文件語言一致）。
6. **不要等使用者確認草稿。** subagent 查完就直接開 issue。使用者要改再改，不要拿草稿卡住流程。

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

找到 2-5 個高相關檔案就夠，寫**路徑與為什麼相關**，**不要寫行號**——行號是你現在這一刻的斷言，worker 之後才動手，中間可能有別的 PR 位移它；worker 照過期的行號去看會看到別的東西並自己合理化，而那在 PR 裡很難發現。語意描述不會過期，worker 自己 grep 只要兩秒。完全找不到時，在 issue 寫「涉及檔案：待確認」，並在「需要的資訊」說明你搜過什麼關鍵字。

### Step 3：判斷類型與大小

兩個維度要分開判，缺一個都會派錯。

**3a　類型**

| 類型 | 判斷 | 對 issue 的影響 |
|---|---|---|
| bug | 現況與預期不符 | 要寫重現步驟 |
| enhancement | 現況正常，使用者想要更好 | 要寫目前行為與期望行為的差異 |
| 需要決策 | 有多種做法且影響 UX | 列出選項，標明要使用者先決定 |

第三類**不要**加 `orca-ready`，改加 `orca-needs-decision`，並在最後告訴使用者這張要先討論。

**3b　大小：這張一個 PR 做得完嗎？**

派工的形狀是 1 issue = 1 worktree = 1 PR，所以判準就這一句，不是複雜度、不是工時。

| 答案 | 徵兆 | label |
|---|---|---|
| 做得完 | 改動集中在一個模組；驗收條件列得出來；不動 schema | `orca-ready` |
| 做不完 | 要動 migration ＋前後端；要先決定架構；驗收條件寫不出來只能寫「做好」 | `orca-needs-spec`（**不加** `orca-ready`） |

**不確定時判「做得完」。** 兩個方向的代價不對稱：

- 判小判錯 → worker 撞牆、回貼 `orca-needs-spec`，花掉的是 token
- 判大判錯 → 你審一份不該存在的規格，花掉的是你的時間

貼 `orca-needs-spec` 的要在回報裡說明為什麼做不完，使用者才知道要不要跑 kiro。

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
- `path/to/file.tsx` — （這個檔案為什麼相關，寫語意不寫行號，例如「切換用的 setInterval 在這裡，進度條要跟它同一個常數」）

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

草稿不必等使用者點頭。subagent 直接進 Step 5 開 issue，草稿內容當成 issue 內文。

**例外**是 Step 3 判出「不派工」的兩種：需要決策（3a 第三類）與一個 PR 做不完（3b）。那兩種 subagent 一樣直接開 issue，但貼 `orca-needs-decision` / `orca-needs-spec` 而非 `orca-ready`，並在回報裡點明這張在等使用者什麼。

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
- 依類型加 `bug` 或 `enhancement`（一定要有一個）
- 派工用的 label **三選一**，不可同時貼兩個：
  - `orca-ready` — 小任務，貼上去 webhook 幾秒內就派工（預設）
  - `orca-needs-decision` — 要使用者先選方向（3a 第三類）
  - `orca-needs-spec` — 一個 PR 做不完，要先跑 kiro（3b）

### Step 6：回報

subagent 回三行給主 session：

1. issue 連結與號碼
2. label（`orca-ready` 已貼好就會自動派工；貼 `orca-needs-*` 的要說明在等使用者什麼）
3. 一句話說這張 issue 要做什麼

派工是事件驅動的：貼上 `orca-ready` 後 webhook 幾秒內就建好 worker worktree，不用手動跑腳本。要手動補派才用 `bash scripts/orca-dispatch.sh --issue <號碼>`。

## 完成判準

- issue 已建立，且 `orca-ready` / `orca-needs-decision` / `orca-needs-spec` 恰好有一個
- Step 3 的兩個維度都判過了（類型 + 一個 PR 做得完嗎）
- 內文的「需要的資訊」與「驗收條件」都不是空的
- 本次沒有動到任何程式碼檔案
- 主 session 在派出 subagent 後就回話了，沒有等查證跑完
