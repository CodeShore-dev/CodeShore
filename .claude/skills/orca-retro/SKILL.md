---
name: orca-retro
description: 每週回顧 Orca 派工的產出，把「使用者不得不自己出手」的訊號轉成對 steering / skill 的修改，並記進 docs/pacer-log.md。當使用者說「orca retro」「回顧這週」「修工廠」「看一下這週的訊號」時使用。
allowed-tools: Read, Glob, Grep, Bash, Edit
argument-hint: [時間範圍，預設 1 week ago]
---

# orca-retro Skill

## Role

你負責把散在 commit、PR、issue 裡的「工廠壞了」訊號收集起來，攤給使用者看，經他同意後改
`.kiro/steering/` 或 `.claude/skills/`，並在 `docs/pacer-log.md` 留帳。

這件事的意義寫在 `docs/pacer-log.md` 開頭：拿鉛筆是訊號，接著要修的是那座工廠。**你不是在檢討
程式碼品質，你在找「如果規範當初多寫一句，這次就不用人出手」的地方。**

## 硬規則

1. **一次最多提兩條。** 改五條就分不出是哪一條有效。
2. **沒有使用者點頭不准改檔案。** Step 4 先提案，等他選。
3. **一次性的事丟掉。** typo、手滑、外部服務壞掉都不是工廠問題。
4. 一輪只開一個 commit，零件改動與 `docs/pacer-log.md` 那一列必須在同一個 commit 裡。
5. 回報與文件用**繁體中文**。

## 執行步驟

### Step 1：撈訊號

時間範圍取 `$1`，沒給就是 `1 week ago`。

```bash
SINCE="${1:-1 week ago}"

# 訊號 A：使用者自己出手的 commit（沒有 Orca-Worker trailer 的就是鉛筆）
git log --no-merges --invert-grep --grep='Orca-Worker' --since="$SINCE" --format='%h %ad %s' --date=short

# 訊號 B：worker 在 PR 寫的「## 工廠回饋」
gh pr list --state merged --limit 20 --json number,title,body,mergedAt \
  -q '.[] | select(.mergedAt > "'"$(date -d "$SINCE" +%Y-%m-%d)"'") | "PR#\(.number) \(.title)\n\(.body)"'

# 訊號 C：worker 卡住問過什麼
gh issue list --label orca-needs-info --state all --limit 20 --json number,title,comments

# 訊號 D：成本離群與沒照 SOP 的 worker
python3 scripts/orca-cost-audit.py

# 訊號 E：你改掉了 agent 預審的哪幾點
gh pr list --state merged --limit 20 --json number,title,comments,mergedAt \
  -q '.[] | select(.mergedAt > "'"$(date -d "$SINCE" +%Y-%m-%d)"'") | "PR#\(.number)\n\(.comments[].body)"' \
  | grep -A40 'agent 預審'
```

訊號 B 只讀 `## 工廠回饋` 那一節，三格都是「無」的跳過。
訊號 A 要看 diff 判斷他改了什麼，不要只看 commit 標題。

訊號 D 跟另外三種不一樣：**A／B／C 都要「人出手了」或「worker 卡住了」才會響，但「東西能動、只是在燒錢」不會讓任何人出手。** 那種問題只有數字看得到，所以每輪一定要跑一次。它印兩種東西：

- **⚠ 成本離群**（tok/行 超過中位數 × 2.5）→ 跑 `--dive <issue>` 看是回合太多還是單次讀太大，必要時再 `--timeline <issue>` 逐筆看。拿它去跟那張 issue 的 PR 對照，找出哪一段在原地打轉
- **✗ 沒照 SOP**（漏跑 `kiro-review` / `kiro-verify-completion`）→ 這是 skill 或 steering 沒把那一步寫成硬性的訊號，不是那個 worker 的錯

只有五六個樣本時中位數不穩，**別拿單一一次離群就改工廠**；要看它是不是同一類原因連續出現兩次。

訊號 E 是 `orca-pr-review` 的回流。把它列的點跟你實際的處置對起來，分三類：

- **它標了、你也覺得要改** → 預審有效，不用動
- **它標了、你看完覺得不用管** → 它在湊點數或判準太寬，改 `orca-pr-review` 的 Step 3 砍除規則
- **它沒標、但你自己抓到了** → 最有價值的一類。它 Step 2 的四個問題漏了你真正在乎的那一項，補進去

這就是 Zach 那場演講 skill loop 的原話例子：review agent 留評論、人修正那些評論、observer
看這個差異讓下一輪變好。差別只在這裡的 observer 是你每週跑一次的這個 skill。

### Step 2：過濾

對每一筆問同一句話：

> **如果 `.kiro/steering/` 或某個 skill 當初寫了什麼，這次就不用人出手？**

答不出來的丟掉，並在回報裡列進「丟掉的」，一行講完為什麼。

### Step 3：分類

留下來的每一筆，照這三問決定改哪個檔：

```
① steering 有寫嗎？
   沒寫  → 補 .kiro/steering/<相關檔>.md
   有寫  → 往下
② skill 有要求讀那個檔嗎？
   沒有  → 改對應 skill（frontend-standards.md 是按需讀的，注意這類）
   有    → 往下
③ 規範自己矛盾嗎？（規範說 A、現場是 B）
   會    → 解掉矛盾，不要兩邊都留
```

對照表：

| 訊號長什麼樣 | 代表什麼壞了 | 改哪裡 |
|---|---|---|
| worker 說「steering 沒講 X」 | 規範不足 | `.kiro/steering/*.md` |
| 使用者自己動手改 code | 規範不足，而且 worker 連不知道都沒察覺（更嚴重） | `.kiro/steering/*.md` |
| worker 貼 `orca-needs-info` 問 | issue 輸入格式不足 | `.claude/skills/orca-issue/SKILL.md` |
| worker 猜了、猜對了、但跟鄰居不一致 | 規範與現場矛盾 | 先解矛盾，再同步寫進 skill |
| 測試全綠但實際不合用 | 測試要求不足 | `orca-issue-work` Step 4 / 5 |
| 某張 issue 的 tok/行 離群 | 有個關卡或規範讓 worker 原地打轉 | 先 `--dive` 找出打轉的那一段，再改那一段對應的規範 |
| worker 漏跑 `kiro-review` 之類 | SOP 寫在步驟裡但沒寫進完成判準 | `orca-issue-work` 的「完成判準」 |
| 預審標的點你都覺得不用管 | 預審判準太寬，在湊點數 | `orca-pr-review` Step 3 的砍除規則 |
| 預審沒標但你自己抓到 | 預審的四個問題漏了一項 | `orca-pr-review` Step 2 |

改規範時**先查現場多數**（例如 `find apps libs -name "*.test.ts*" | wc -l`），不要照規範原文硬推，
否則會把多數檔案變成違規。

### Step 4：提案，等使用者選

用這個格式回報，然後**停下來**：

```
這段時間撈到 N 個訊號，M 個值得改工廠。

① <一句話講症狀>
   證據：<PR#／commit hash／issue#>
   現況：<查到的數字或矛盾>
   建議：<檔案:行> 改成 <內容>
   要改嗎？

② …

（丟掉的）
- <一行> — 一次性，不是工廠問題
```

### Step 5：改，並留帳

使用者點頭的才改。每一條都做完這三件事：

1. 改零件（`.kiro/steering/*.md` 或 `.claude/skills/*/SKILL.md`）
2. 檢查**有沒有第二處也在講同一條規則**（例如 `structure.md` 與 `orca-issue-work` Step 4 都講測試檔），
   有就一起改，不然規則跟範例會打架
3. `docs/pacer-log.md` 的「紀錄」表加一列：`| 日期 | 格 | 我出手的症狀 | 改了什麼 | 下次的判準 |`

然後開一個 commit：

```bash
git add -A
git commit   # chore(agent): <一句話講改了什麼工廠零件>
```

commit 訊息結尾加本 session 規定的 Co-Authored-By 署名行。**不要**加 `Orca-Worker` trailer——
這不是派工產出。

### Step 6：印出進度

```bash
# 修工廠的次數（目標：每週 1-2 次）
git log --oneline --since='1 month ago' -- .kiro/steering .claude/skills | wc -l
# 鉛筆率（trailer 累積 10 個 PR 以上才有意義）
echo "worker: $(git log --no-merges --grep='Orca-Worker' --oneline | wc -l)"
echo "我出手: $(git log --no-merges --invert-grep --grep='Orca-Worker' --oneline | wc -l)"
```

## 沒有訊號時

三個來源都空的話，直接說「這段時間沒有值得改工廠的訊號」，不要硬湊。
沒訊號有兩種可能，順便判斷是哪一種：

- 真的順 → 好事
- 沒有人在填 `## 工廠回饋`（PR 全是「無」）→ 這本身就是一筆訊號，該改 `orca-issue-work` 的填法說明

## 完成判準

- 提案有給使用者選，沒有先改檔
- 改動與 `docs/pacer-log.md` 那一列在同一個 commit
- 同一條規則的所有出現處都改了，沒有留下打架的版本
