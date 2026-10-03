#!/usr/bin/env bash
# orca-review-dispatch.sh — PR 一開就派一個乾淨 session 預審，貼 orca-review-clean / flagged。
#
# 為什麼要另一個 session：worker 在 Step 6 已經跑過 kiro-review，但那是在它自己的 context 裡，
# 共用它寫 code 時的全部假設。自己審自己篩不掉自己的盲點，所以你還是得從頭看整份 diff。
# 這裡的 agent 只拿 diff ＋ issue 的驗收條件與邊界 ＋ steering，看不到 worker 的推理。
#
# 用法：
#   bash scripts/orca-review-dispatch.sh --pr 28
#   bash scripts/orca-review-dispatch.sh --pr 28 --dry-run
#   bash scripts/orca-review-dispatch.sh --pr 28 --force     # 已經審過也再審一次
#
# 不用 Orca worktree：預審是唯讀的，不需要 branch，也不該占掉那三個派工名額。
#
# 環境變數：
#   ORCA_REVIEW_MODEL  預設 claude-sonnet-5。預審是讀 diff，不需要更貴的模型。
#   ORCA_REVIEW_SKIP   設成 1 就整個停用（webhook 也會跟著不跑）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/orca-lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/orca-lib.sh"

MODEL="${ORCA_REVIEW_MODEL:-claude-sonnet-5}"
PR=""
DRY_RUN=0
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --pr) PR="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

log() { printf '[orca-review] %s\n' "$*"; }

[ -z "$PR" ] && { log "要給 --pr <號碼>。"; exit 2; }

if [ "${ORCA_REVIEW_SKIP:-0}" = "1" ]; then
  log "ORCA_REVIEW_SKIP=1，這輪不審。"
  exit 0
fi

cd "$ROOT"

meta=$(gh pr view "$PR" --json isDraft,labels,state 2>/dev/null) || {
  log "拿不到 PR #$PR，可能還沒建好或沒權限。"
  exit 1
}

state=$(printf '%s' "$meta" | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])')
if [ "$state" != "OPEN" ]; then
  log "PR #$PR 不是 OPEN（$state），不審。"
  exit 0
fi

is_draft=$(printf '%s' "$meta" | python3 -c 'import json,sys; print(json.load(sys.stdin)["isDraft"])')
if [ "$is_draft" = "True" ]; then
  log "PR #$PR 是 draft，不審。等它 ready_for_review。"
  exit 0
fi

reviewed=$(printf '%s' "$meta" | python3 -c '
import json,sys
names = {l["name"] for l in json.load(sys.stdin)["labels"]}
print("1" if names & {"orca-review-clean", "orca-review-flagged"} else "0")
')
if [ "$reviewed" = "1" ] && [ "$FORCE" != "1" ]; then
  log "PR #$PR 已經審過（有 orca-review-* label）。要重審加 --force。"
  exit 0
fi

prompt="審 PR #${PR}。

第一步：用 Skill 工具呼叫 orca-pr-review，args 是 ${PR}。
那份 skill 寫了完整規則：只拿 diff、issue 的驗收條件與不在範圍內、steering，
產出最多 5 點「使用者要看的」，然後貼 orca-review-clean 或 orca-review-flagged。

你是第二雙眼睛。**不要**去讀 worker 的 commit message 解釋、issue 留言、或 PR 內文的
「怎麼做的」那節——看不到它的推理正是你的價值。

不要問我要不要開始，直接開始。不要改任何程式碼。"

if [ "$DRY_RUN" = "1" ]; then
  log "[dry-run] 會用 $MODEL 審 PR #$PR"
  printf '%s\n' "$prompt"
  exit 0
fi

log "派預審 PR #$PR（model: $MODEL）"

# 唯讀 + gh。不用 --dangerously-skip-permissions：這個 session 不該有寫檔能力。
#
# gh 刻意不給 `gh:*`：這個 session 讀的是 worker 產出的 diff 與 issue 內文，兩者都不是
# 使用者親手寫的。收到用得到的那幾個子命令，`gh api` / `gh repo` / `gh secret` 都排除。
CLAUDE_BIN="$(resolve_claude)" || exit 1
if "$CLAUDE_BIN" -p "$prompt" \
    --model "$MODEL" \
    --allowedTools "Read" "Grep" "Glob" "Skill" \
    "Bash(gh pr view:*)" "Bash(gh pr diff:*)" "Bash(gh pr comment:*)" "Bash(gh pr edit:*)" "Bash(gh issue view:*)" \
    "Bash(git diff:*)" "Bash(git log:*)" \
    2>&1 | sed 's/^/[orca-review] /'; then
  log "PR #$PR 預審結束。"
else
  log "PR #$PR 預審失敗（exit $?）。不影響 PR 本身，你照常自己 review。"
  exit 1
fi
