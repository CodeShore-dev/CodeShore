---
name: orca-issue-work
description: 在 Orca 自動派工的 worktree 裡處理一張 GitHub issue，從讀 issue 到開 PR 為止。當提示要求你處理某個 issue 號碼、或你所在的 worktree 由 orca-dispatch.sh 建立時使用。
allowed-tools: Read, Write, Edit, MultiEdit, Bash, Glob, Grep, Agent, Skill
argument-hint: <issue-number>
---

# orca-issue-work Skill

## Role
你獨自負責一張 issue，在一個專屬的 worktree 與 branch 裡，從讀 issue 做到開 PR。使用者不在旁邊，**不要問「要不要開始」**，直接開始。

## 硬規則

1. **只做 issue 寫明的事。** 「不在範圍內」那段是禁區。順手看到的其他問題，另開 issue 記錄，不要一起改。
2. **資訊不足就問，不要猜。** 見下方「卡住時」。
3. **驗收條件沒全綠不准開 PR。** 未通過的項目要在 PR 內文明白列出。
4. **不要 push 到 main。** 只 push 你自己的 branch。
5. 文件、commit、PR 內文用**繁體中文**。

## 執行步驟

### Step 1：讀 issue 與規範

```bash
gh issue view <number> --json number,title,body,labels,comments
git branch --show-current   # 確認你在派工的 branch，不是 main
```

同時讀：
- `.kiro/steering/product.md`、`tech.md`、`structure.md`
- 改到前端時加讀 `.kiro/steering/frontend-standards.md`

在 branch 是 `main` 時，**停手**並回報。派工腳本應該給你獨立 branch。

### Step 2：檢查 issue 夠不夠動手

逐條看 issue 的「需要的資訊」。每一條問自己：我能從程式碼自己查出答案嗎？

- 能 → 自己查，把結論寫進 issue 留言，繼續做
- 不能，且猜錯會做白工 → 走「卡住時」流程

### Step 3：確認現況

先重現，再動手：

- bug：從 issue 的重現步驟找到出錯的那幾行，確認你看到的行為與 issue 描述一致。描述對不上時，以程式碼為準，並在 issue 留言指出差異。
- enhancement：確認目前行為，並確認你的改法沒有跟既有設計衝突。

### Step 4：實作

依 `.kiro/steering/` 的規範改。要求：

- 測試先行：先寫會失敗的測試，再寫實作（有測試檔慣例的範圍內）
- 測試檔與被測檔同層。命名前後端不同：前端（`apps/frontend/src`）用 `*.test.ts` / `*.test.tsx`，
  後端與 `libs/` 用 `*.spec.ts`。判準見 `.kiro/steering/structure.md` 的命名慣例表
- 改動範圍控制在 issue 涉及的模組內
- 不新增依賴，除非 issue 明講

### Step 5：驗證

```bash
pnpm nx test frontend      # 或 backend，看改到哪
pnpm nx lint frontend

# 格式只檢查本次改動的檔案，不檢查全庫
git diff --name-only --diff-filter=ACMR main...HEAD -- '*.ts' '*.tsx' \
  | xargs -r npx prettier --check --end-of-line lf
```

格式那行**只給改動檔**。全庫 `pnpm ptr:format:check` 在 `main` 上就是紅的（578 個檔有 552 個
不符 `.prettierrc`），拿它當關卡量不出退化。也不要跑 `pnpm ptr:format`，那會重排數百個無關檔案。
細節見 `.kiro/steering/tech.md` 的「已知落差」。

`pnpm nx lint` 同理：`main` 上既有 62 個 error。判準是**數量與基準線相同、且改動檔本身零 finding**，
不是全綠。

接著呼叫 `kiro-verify-completion` skill，用新鮮證據逐條核對 issue 的驗收條件。這一步不可跳過。

測試失敗且連續三次修不好時，呼叫 `kiro-debug` skill 從根因查，不要繼續亂試。

### Step 6：Review

呼叫 `kiro-review` skill，對照 issue 的驗收條件與「不在範圍內」做對抗式檢查。reviewer 指出的問題修掉後再重跑 Step 5。

### Step 7：Commit 與 PR

```bash
git add -A
git commit   # 訊息格式見下
git push -u origin HEAD
gh pr create --title "<標題>" --body-file <(...)
gh issue edit <number> --add-label orca-in-pr --remove-label orca-dispatched
```

Commit 訊息（沿用本 repo 慣例）：

```
fix(job): 薪資篩選 slider 拖到上限不再歸零

值超過上限時改為夾在上限，不再 wrap 回 0。
補上 useSalaryRange 的邊界測試。

Closes #42

Orca-Worker: issue #42
```

- 型別用 `feat` / `fix` / `refactor` / `test` / `docs`
- scope 是受影響的功能模組名（`job`、`company`、`techs` 之類），不是 issue 號碼
- 主旨用繁體中文，一行講完做了什麼
- 結尾加本 session 規定的 Co-Authored-By 署名行
- 再**另外**加一行 `Orca-Worker: issue #<number>`（放在最後）。這是派工 worker 的產出標記，用來跟使用者自己動手的 commit 區分——`Co-Authored-By` 兩者都有，分不出來。用途見 `docs/pacer-log.md`

PR 內文結構：

```markdown
## 解決什麼
Closes #42

## 怎麼做的
- （改動摘要，一項一行）

## 驗收條件核對
- [x] （issue 的條件）— 證據：`useSalaryRange.spec.ts:88` 通過
- [x] 既有測試不退化 — `pnpm nx test frontend`：基準線 1006 passed / 2 failed，本 PR 1009 passed / 2 failed，失敗集合相同

## 未處理 / 待討論
- （沒有就寫「無」）

## 工廠回饋
- steering 沒講清楚的：
- 我試了幾次才對，卡在哪：
- issue 當初多寫一句什麼，我會更快：
```

`## 工廠回饋` 的填法（這節是給使用者改工廠用的，不是檢討）：

- **只寫「如果規範當初多寫一句，我這次就不用猜」的事**，三格都沒有就各寫「無」
- 規範沒寫、但現場有慣例可跟時（例如資料夾裡既有檔案的命名），**照現場做並在這裡寫下來**，不要停下來問——判準見 Step 2「猜錯會不會做白工」
- 例：`structure.md` 沒講這個 feature 的 store 該不該拆檔，我照隔壁 feature 的單檔寫法做
- 不要寫「我覺得程式碼可以更好」那類感想，那不是工廠問題

PR 內文結尾加本 session 規定的 `🤖 Generated with Claude Code` 署名行。

### Step 8：更新 Orca 狀態

```bash
ORCA=${ORCA_CLI_COMMAND:-orca-ide}
$ORCA worktree set --worktree active --workspace-status in-review --json
$ORCA worktree set --worktree active --comment "PR 已開，等 review" --json
```

這步失敗不算工作失敗，記一筆繼續。

## 卡住時

資訊不足或需要使用者決策時：

```bash
gh issue comment <number> --body "需要確認：…（一次問完，列點，附上你已經查到的部分）"
gh issue edit <number> --add-label orca-needs-info
ORCA=${ORCA_CLI_COMMAND:-orca-ide}
$ORCA worktree set --worktree active --workspace-status todo --comment "等使用者回覆 issue #<number>" --json
```

把已經完成的部分 commit 在 branch 上，不要丟掉。然後停下來，不要猜著往下做。

## 完成判準

- PR 已開且連回 issue（`Closes #<number>`）
- 驗收條件逐條有證據，未達成的已在 PR 明白列出
- issue label 為 `orca-in-pr`
- PR 的 `## 工廠回饋` 三格都填了（沒有就是「無」，不可留空）
- 沒有動到 issue 範圍外的檔案
