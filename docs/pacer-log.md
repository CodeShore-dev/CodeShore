# PACER 工廠日誌

記錄「我為什麼出手，以及我改了哪個零件讓下次不必出手」。

出自 Rails World 2026 Opening Keynote（DHH）第 11 段：拿鉛筆是訊號，就像在 Sentry
裡看到一個 bug——它的意義是「有東西壞了」。短期還是會拿鉛筆補一下，但接著要修的
是那台機器、那座工廠。這個檔案就是那些修改的帳。

## 寫入時機

每週跑一次 `/orca-retro`。那個 skill 會撈訊號、提案、等你點頭，然後改零件並在這裡加一列，
零件改動與那一列在同一個 commit 裡。

不要靠記性維護這個檔——改工廠跟記一筆是同一件事，分開就會停。手動改工廠時也一樣，
同一個 commit 帶這裡一行。

素材從哪來：

- PR 內文的 `## 工廠回饋`（worker 當下寫的「卡在哪、steering 少了什麼」）
- 你自己動手的 commit：`git log --no-merges --invert-grep --grep='Orca-Worker' --oneline`

## 漏記查核

```bash
git log --oneline -- .kiro/steering .claude/skills scripts/orca-* CLAUDE.md | wc -l   # 修工廠的次數
grep -c '^| 20' docs/pacer-log.md                            # 記下來的次數
```

兩個數字應該接近。差很多就是有幾次改了工廠沒留帳。

## 鉛筆率

`Orca-Worker:` trailer 累積到 10 個以上 PR 之後才有意義（約 2–3 週）：

```bash
# 分母：worker 自主完成的 commit
git log --no-merges --grep='Orca-Worker' --oneline | wc -l
# 分子：我自己出手的 commit
git log --no-merges --invert-grep --grep='Orca-Worker' --oneline | wc -l
```

判準不是「鉛筆率要到 0」，是**它在降，而且每一次降都指得出是本表哪一列造成的**。

## PACER 對照

| 格 | 在問什麼 | 這個 repo 的對應 |
|---|---|---|
| P14 | agent 做不到時，改的是機器還是程式碼 | `.kiro/steering/`、`orca-issue-work` skill |
| P22 | 是非同步指派，還是坐在聊天室裡等 | `orca-dispatch.sh` → worktree → PR |
| P24 | 指派的是結果，還是實作 | issue body 的形狀（`orca-issue` skill 決定） |
| P32 | 別人的 agent 進不進得來 | CodeShore 還沒有 CLI |

---

## 紀錄

| 日期 | 格 | 我出手的症狀 | 改了什麼 | 下次的判準 |
|---|---|---|---|---|
| 2026-09-30 | P22 | steering 載入靠 agent 自覺（CLAUDE.md 只有一句請求，沒有 @import 也沒有 hook），不走 kiro 就可能沒讀到 | `CLAUDE.md` 的 Steering Configuration 換成三行 `@import`；`frontend-standards.md` 留給 skill 按需讀 | 每個 session 開場就有 product / tech / structure，不分幹道 |
| 2026-09-30 | P24 | issue 的「涉及檔案」帶 `路徑:行號`。行號是開 issue 當下的斷言，平行派工（`--limit 3`）時可能已被別的 PR 位移；worker 照過期行號去看會自己合理化，PR 裡看不出來 | `orca-issue/SKILL.md` 的搜尋指示與輸出模板都改成寫語意、不寫行號 | worker 不再因為看錯位置而合理化；issue 的檔案清單不會過期 |
| 2026-09-30 | P14 | 訊號只在 worker 喊卡或我出手時才響。「它做完了、能用、但跟鄰居不一致」完全沒有訊號——`.spec` / `.test` 分裂（PR#25 用 spec、PR#28 用 test）就是這樣溜過去的 | `orca-issue-work/SKILL.md` 的 PR 內文結構加 `## 工廠回饋` 三格，填法寫進說明，並列入完成判準 | 每個 PR 都說得出「我猜過什麼」，猜了要留單但不必停下來問 |
| 2026-09-30 | P14 | 有訊號也沒人固定回頭看。靠記性每週回顧＝不會發生 | 新增 `/orca-retro` skill：撈三種訊號 → 一句話過濾 → 三問分類 → 提案等點頭 → 改零件＋記帳一個 commit | 每週一個指令，`git log -- .kiro/steering .claude/skills` 每週有 1–2 筆 |
| 2026-09-30 | P14 | agent 與我的 commit 混在一起（都掛 chaol，`Co-Authored-By: Claude` 兩者都有），量不出「這個月我出手幾次」 | `orca-issue-work/SKILL.md` 的 commit 規則與範例加 `Orca-Worker: issue #<N>` trailer | `git log --invert-grep --grep='Orca-Worker'` 只剩我自己的 commit，鉛筆率可算 |
| 2026-09-30 | P14 | 測試檔命名分裂：PR#25 建 `.spec.tsx`（跟 skill），PR#28 建 `.test.tsx`（跟鄰居）。skill 無條件要求 `.spec`，但前端現有 `.test` 153 / `.spec` 13，後端 `.spec` 71 / `.test` 0 | `structure.md` 前端 feature 結構補測試檔一行、命名慣例表加前後端兩列並附現況數字；`orca-issue-work` Step 4 改成前後端分開講；同檔「工廠回饋」原本拿這件事當例子，換掉以免打架 | worker 不必猜命名；前端進 `.test`、後端進 `.spec`，不再一週出兩種 |
| 2026-09-30 | P14 | `ptr:format:check` 是假關卡。PR#25、#26、#28 各花一段字解釋它為何紅，三次內容幾乎一樣。`.prettierrc` 與現場落差 552/578（`printWidth: 120` vs 現場約 80 欄；`endOfLine: crlf` vs 多數 LF） | `tech.md` Code Quality 加「已知落差」節，明寫不是關卡、不要跑 `--write`；`orca-issue-work` Step 5 的格式檢查改成只檢 `git diff` 的改動檔，並把 lint / test 判準從「全綠」改成「與基準線相同」（PR 模板那列一起改） | worker 不再重寫同一段解釋；「不退化」判準是對基準線，不是對全綠 |
| 2026-10-02 | P22 | 停在等人的 issue 有兩種（`question`、`orca-needs-info`），但 `question` 是 GitHub 內建 label、不在 `orca-*` 家族裡。看板上看不出它為什麼沒被派工，要翻 skill 才知道 | 新增 `orca-needs-decision` label（取代 `question`）；`orca-issue/SKILL.md` 四處引用一起改 | 所有「停下來等人」的狀態都叫 `orca-needs-*`，看 label 名就知道卡在哪、該做什麼 |
| 2026-10-02 | P24 | `orca-issue` Step 3 只判類型（bug／enhancement／需要決策），不判大小。只要不是「需要決策」一律貼 `orca-ready` 直接派——即使那張要動 migration ＋前後端。worker 只能硬做完或中途卡住 | Step 3 拆成 3a 類型／3b 大小「這張一個 PR 做得完嗎」；新增 `orca-needs-spec` label；派工 label 改成三選一；完成判準加一條 | 做不完的不會進 worktree；不確定時判小，因為人的時間比 token 貴 |
| 2026-10-02 | P14 | 3b 的大小判斷只在 `orca-issue` 做，而它是從畫面判的、看不到程式碼。判錯時 worker 沒有退路——硬規則 1 要它只做 issue 寫明的事，硬規則 3（原）要它驗收全綠才能開 PR，兩條夾住只剩硬做完 | `orca-issue-work` 加硬規則「一個 PR 做不完就退回」、「太大時」一節（四個徵兆＋回貼 `orca-needs-spec` 的指令），Step 3 確認現況後加一次大小複驗 | 真實範圍比畫面大的時候退得回去；退回的留言留在 issue 上，是跑 kiro 時的現成材料 |
| 2026-10-02 | P14 | 每個 worker 都在白付 context：Step 1 叫它讀 `product/tech/structure.md`，但 `CLAUDE.md` 的 `@import` 開場就載過了（同一份進兩次，第二次還帶行號）；`CLAUDE.md:50` 的「1% chance 就載 skill」是寫給主 session 的，worker 照做會去載 `kiro-impl`（16 KB）這種 spec 階段才用得到的東西 | Step 1 改成「已在 context，不要再 Read」，只留 `frontend-standards.md` 按需讀；硬規則加第 7 條，worker 只准用 `kiro-debug` 與 `kiro-verify-completion` | 一個 worker 的 preamble 省約 2,500 tokens 且不再載無關 skill；真正的大戶仍是重試次數，看 `## 工廠回饋` |
| 2026-10-02 | P14 | 訊號 A／B／C 都要「人出手了」或「worker 卡住了」才會響。PR#28 有 48% 的工具呼叫困在 `ptr:format:check`、中途 `git checkout --` 把改好的全丟掉重做一遍、燒掉約 1M token——沒有人出手、worker 也沒卡住，所以 9/30 那輪只從 PR 內文看到「解釋了三次」，排在最後一條 | 新增 `scripts/orca-cost-audit.py`（從 worker transcript 算 tok/行、回合數、漏跑的 skill，`--dive` / `--timeline` 下鑽），接進 `orca-retro` Step 1 當訊號 D，對照表加兩列；漏記查核的 `git log` 範圍補上 `scripts/orca-*` 與 `CLAUDE.md` | 每輪看得到成本離群與 SOP 漏跑；離群要同一類原因連兩次才改工廠，單次不算 |
| 2026-10-02 | P14 | `.prettierrc` 的全庫落差只被移出關卡、沒有解掉，所以下一個 worker 碰到格式問題還是會掉進 PR#28 那個洞（48% 工具呼叫、約 1M token）。量過之後發現原本記的兩條路都不通：改設定遷就現況只讓不符數 552→420；全庫重排是 700 檔、+77,409/−84,448 行，而且有一個檔 prettier parse 不過 | 第三條路——把關卡縮到改動檔。`scripts/format-changed.mjs`（main...HEAD ＋ staged ＋ unstaged ＋ untracked，只收程式碼副檔名，`.md` / `.yml` 刻意排除），`pnpm ptr:format(:check)` 改指向它，全庫版改名 `:all` 並標明不要在 issue 裡跑；`.prettierrc` 的 `endOfLine` 改 `lf`；`tech.md` 已知落差與 `orca-issue-work` Step 5 一起改 | `pnpm ptr:format:check` 在乾淨的 main 上是綠的，紅了就是這次改出來的——假關卡變成真關卡，而且沒動到 700 個檔 |

## 還沒做（排隊中）

- **P32 CLI**：`apps/cli` + `tech-trend` 子命令（`job.created_at` 按月分桶算職缺數與 PR50），之後包 MCP。約 1 小時。
- **P24 對照實驗**：下一個 issue 出 B 版——整段砍掉「涉及檔案」，只留驗收條件，跟 A 版比 PR。要做 3–5 次才有結論。
