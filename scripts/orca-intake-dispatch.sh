#!/usr/bin/env bash
# orca-intake-dispatch.sh — 把手機回報的 orca-intake issue 改寫成可派工的七節 issue。
#
# 為什麼要這一層：手機上你給得出的只有「網址 ＋ 一句話 ＋ 寬度」。反查原始碼、對照
# feature-map、判 3a 類型與 3b 大小——這些需要 repo，手機做不到。所以捕捉與分流拆開：
# 手機只捕捉，這支腳本在桌機分流。
#
# 用法：
#   bash scripts/orca-intake-dispatch.sh --issue 42
#   bash scripts/orca-intake-dispatch.sh --scan          # 撈所有 open + orca-intake
#   bash scripts/orca-intake-dispatch.sh --scan --dry-run
#
# --scan 是必須的，不是順手加的：`gh webhook forward` 是臨時 webhook，電腦睡著時的事件
# 直接消失。你在外面開的 issue 回家不會自己動，要靠 listener 啟動時跑一次 --scan。
#
# 不用 Orca worktree：分流只讀程式碼、只寫 issue，不需要 branch，也不該占掉那三個派工名額。
#
# 環境變數：
#   ORCA_INTAKE_MODEL  預設 claude-sonnet-5。分流是讀程式碼與寫 issue，不需要更貴的模型。
#   ORCA_INTAKE_SKIP   設成 1 就整個停用（webhook 也會跟著不跑）。
#   ORCA_INTAKE_LIMIT  --scan 一輪最多處理幾張，預設 5。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${ORCA_INTAKE_MODEL:-claude-sonnet-5}"
LIMIT="${ORCA_INTAKE_LIMIT:-5}"
INTAKE_LABEL="orca-intake"
ISSUE=""
SCAN=0
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --issue) ISSUE="$2"; shift 2 ;;
    --scan) SCAN=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --limit) LIMIT="$2"; shift 2 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

log() { printf '[orca-intake] %s\n' "$*"; }

if [ "${ORCA_INTAKE_SKIP:-0}" = "1" ]; then
  log "ORCA_INTAKE_SKIP=1，這輪不分流。"
  exit 0
fi

if [ -z "$ISSUE" ] && [ "$SCAN" != "1" ]; then
  log "要給 --issue <號碼> 或 --scan。"
  exit 2
fi

cd "$ROOT"

# 要處理的 issue 清單
if [ -n "$ISSUE" ]; then
  numbers="$ISSUE"
else
  numbers=$(gh issue list --state open --label "$INTAKE_LABEL" \
            --limit 50 --json number --jq '.[].number' | head -n "$LIMIT")
  count=$(printf '%s\n' "$numbers" | grep -c . || true)
  log "--scan 找到 $count 張待分流（上限 $LIMIT）。"
  [ "$count" = "0" ] && exit 0
fi

dispatch_one() {
  local num="$1"

  # 還掛著 orca-intake 才處理。已經被分流過的會換成 orca-ready / needs-*，
  # 所以這個檢查讓 --scan 可以重複跑而不會重做。
  local labels
  labels=$(gh issue view "$num" --json labels --jq '[.labels[].name] | join(",")' 2>/dev/null) || {
    log "#$num 拿不到，跳過。"
    return 0
  }
  case ",$labels," in
    *",$INTAKE_LABEL,"*) : ;;
    *) log "#$num 已經不是 $INTAKE_LABEL（現在是 $labels），跳過。"; return 0 ;;
  esac

  local prompt="分流 orca-intake issue #${num}。

第一步：用 Skill 工具呼叫 orca-intake，args 是 ${num}。
那份 skill 寫了完整規則：從 issue 讀出網址／一句話／寬度，對照
\`.kiro/steering/feature-map.md\` 找出是哪個功能，反查原始碼，改寫成七節 issue，
然後貼 orca-ready／orca-needs-decision／orca-needs-spec 三選一並移除 orca-intake。

**原地編輯這張 issue，不要另開一張。** 使用者的原話要保留。
不要問我要不要開始，直接開始。不要改任何程式碼。"

  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] 會用 $MODEL 分流 #$num"
    return 0
  fi

  log "分流 #$num（model: $MODEL）"

  # 唯讀程式碼 + 可寫 issue。不給 Edit/Write：分流不改程式碼。
  if claude -p "$prompt" \
      --model "$MODEL" \
      --allowedTools "Read" "Grep" "Glob" "Skill" "Bash(gh:*)" "Bash(git log:*)" "Bash(orca-ide:*)" \
      2>&1 | sed 's/^/[orca-intake] /'; then
    log "#$num 分流結束。"
  else
    log "#$num 分流失敗（exit $?）。issue 還掛著 $INTAKE_LABEL，下一輪 --scan 會再試。"
    return 1
  fi
}

failed=0
for num in $numbers; do
  [ -z "$num" ] && continue
  dispatch_one "$num" || failed=1
done
exit "$failed"
