---
name: orca-intake
description: 把手機回報的 orca-intake issue 原地改寫成可派工的七節 issue，並貼上 orca-ready / orca-needs-decision / orca-needs-spec 三選一。當提示要求你分流某個 intake issue 號碼、或你由 orca-intake-dispatch.sh 啟動時使用。
allowed-tools: Read, Bash, Glob, Grep
argument-hint: <issue-number>
---

# orca-intake Skill

## Role

你是**分流那一格**。手機上使用者給得出的只有三樣：網址、一句話、畫面寬度。反查原始碼、
對照功能、判類型與大小——這些需要 repo，手機做不到，所以留給你。

跟 `orca-issue` 的差別只有入口：它從 Orca 圈選拿到元素資訊（選擇器、元件名、DOM 路徑），
**你沒有那些**。你只有一句話加一個網址。補足的方法是 `.kiro/steering/feature-map.md`。

## 硬規則

1. **原地編輯這張 issue，不要另開一張。** 用 `gh issue edit <N> --body-file`。
2. **使用者的原話逐字保留。** 不要改寫成你的說法，不要修飾成需求規格。
3. **不要改程式碼。** 不用 Edit / Write。不 commit。不建 branch。
4. **不要跑 build、test、dev server。**
5. **寬度留空就當「未知」，不要當桌機。** 手機入口的預設不是 1440。
6. **涉及檔案只寫語意，不寫行號。** 理由見 `orca-issue` 的 Step 2。
7. issue 內文用**繁體中文**。
8. 分流完一定要**移除 `orca-intake`**，否則 `--scan` 下一輪會重做。

## 執行步驟

### Step 1：讀 intake issue

```bash
gh issue view <N> --json number,title,body,labels
```

從 issue body 抓出四格（template 是 `.github/ISSUE_TEMPLATE/intake.yml`）：

| 欄位 | 缺的時候 |
|---|---|
| 來源網址 | 必填，缺了就貼 `orca-needs-info` 並問網址 |
| 我的想法 | 必填，缺了同上 |
| 畫面寬度 | 標「未知」，**不要填 1440** |
| 你覺得這是 | 當成直覺不當成結論，Step 4 自己判 |

### Step 2：用 feature-map 對上功能

**先讀 `.kiro/steering/feature-map.md`，再開始 Grep。** 順序不要顛倒。

1. 用網址的**路徑**對上 feature-map 裡的功能（`/jobs` → 職缺、`/techs?mode=combos` → 技術 / 技術組合）
2. 用那句話對上該功能的某個**區塊或操作**
3. 把該功能的「驗收重點」當成 Step 5 驗收條件的起點——那幾條是已合併 issue 累積出來的

對不上任何功能時，才回頭用那句話裡的名詞全庫搜。對得上就不要再搜，省掉一輪。

### Step 3：反查原始碼（唯讀）

照 `orca-issue` 的 Step 2 做，順序一樣。feature-map 已經給你 feature 名稱，所以你可以
直接進 `apps/frontend/src/features/{feature}/`，跳過 router 那一步。

找到 2–5 個高相關檔案就夠。寫路徑與為什麼相關，**不寫行號**。

### Step 3.5（選配）：重現並擷取

Orca 的內嵌瀏覽器可以用 CLI 驅動，拿得到使用者手機上拿不到的東西：

```bash
orca-ide tab create --url "<來源網址>"
orca-ide eval --expression "<裝 console / onerror / unhandledrejection 攔截的 JS>"
orca-ide reload
orca-ide eval --expression "<取出 buffer、走祖先鏈>"
orca-ide screenshot --format png
```

四件事要注意：

1. **順序是「裝攔截 → reload → 取出」。** 直接 `eval` 取只拿得到你執行之後的錯誤，載入期的那些已經沒了
2. **`orca-ide` 沒有 viewport 模擬旗標。** `tab create` 只收 `--url` / `--worktree` / `--profile`。你重現的寬度是那個視窗自己的寬度，不是 390
3. 所以 **你必須在 issue 裡寫出 `window.innerWidth` 的實際值**。在 1440 看 DOM 卻在講 390 的問題，PR 裡看不出來
4. 這一步失敗（Orca 沒開、CLI 不通）就**跳過**，不要卡住。沒有它也分流得出來

RWD 問題不需要真的渲染在 390px：**Tailwind 把斷點寫在 class 名字裡**（`hidden md:flex`、
`grid-cols-1 lg:grid-cols-3`）。拿使用者回報的寬度對 `md:` = 768、`lg:` = 1024，推得出該走哪一支。

### Step 4：判類型與大小

照 `orca-issue` 的 Step 3 做，3a 類型與 3b 大小兩個維度分開判。

**3b 的大小判斷你比 `orca-issue` 準。** 它從畫面判，你已經反查過原始碼了。所以不確定時
仍然判「做得完」，但你有真實依據時就照依據判。

### Step 5：改寫成七節，原地更新

用 `orca-issue` Step 4 的模板，兩處不同：

```markdown
## 出處
- URL：<來源網址>
- 回報裝置寬度：<N>px（未填就寫「未知」）
- 重現時的 window.innerWidth：<M>px（跳過 Step 3.5 就寫「未重現」）
- 入口：手機回報（orca-intake #<N>）
```

標題從 `[intake] ...` 改成 `orca-issue` 的格式：`[前端] 技術組合在手機上文字重疊`。

```bash
gh issue edit <N> --title "<新標題>" --body-file <暫存檔>
```

**判成「需要決策」時，選項必須寫成可以回一個數字的形狀**：

```markdown
## 要你決定
1. 卡片整張可點（最接近你原話）
2. 只有標題可點
3. 保持現狀，只把箭頭放大

回「1」「2」「3」即可。
```

理由：這張 issue 的下一個讀者在手機上。開放式問題在手機上打不完，等於把流程停住。
`orca-needs-info` 的問法同一條規則。

### Step 6：換 label

三選一，並移除 `orca-intake`：

```bash
gh issue edit <N> --add-label orca-ready --remove-label orca-intake
# 或 --add-label orca-needs-decision --remove-label orca-intake
# 或 --add-label orca-needs-spec    --remove-label orca-intake
```

類型是 bug / enhancement 的另外加對應的 GitHub 內建 label。

### Step 7：回報

一段話說完：對上哪個功能、判成哪一類、貼了哪個 label、Step 3.5 有沒有跑成功。
貼 `orca-needs-*` 的要點明「這張在等使用者做什麼」。

## 完成判準

- [ ] issue 原地改寫成七節，標題換掉，原話逐字保留
- [ ] 「出處」有回報寬度與重現寬度兩個值
- [ ] 涉及檔案寫語意，沒有行號
- [ ] 驗收條件起點來自 feature-map 的「驗收重點」
- [ ] `orca-intake` 已移除，三選一的 label 已貼上
- [ ] 判「需要決策」時，選項是可以回一個數字的形狀
