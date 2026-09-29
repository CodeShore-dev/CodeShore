#!/usr/bin/env bash
# orca-dispatch.sh — 把 orca-ready 的 GitHub issue 派給新的 Orca worktree + Claude Code。
#
# 用法：
#   bash scripts/orca-dispatch.sh                # 派工（預設一次最多 3 個）
#   bash scripts/orca-dispatch.sh --dry-run      # 只列出會派什麼，不動作
#   bash scripts/orca-dispatch.sh --limit 1      # 這輪只派 1 個
#   bash scripts/orca-dispatch.sh --issue 42     # 只派指定 issue（忽略 label 篩選）
#
# 前提：Orca app 要開著、gh 要登入、repo 已加入 Orca。
set -euo pipefail

REPO_SELECTOR="${ORCA_REPO_SELECTOR:-name:CodeShore}"
READY_LABEL="${ORCA_READY_LABEL:-orca-ready}"
DISPATCHED_LABEL="${ORCA_DISPATCHED_LABEL:-orca-dispatched}"
LIMIT="${ORCA_DISPATCH_LIMIT:-3}"
DRY_RUN=0
ONLY_ISSUE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --limit) LIMIT="$2"; shift 2 ;;
    --issue) ONLY_ISSUE="$2"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

log() { printf '[orca-dispatch] %s\n' "$*"; }

# 解析 Orca CLI：Orca 管理的 shell 會給 ORCA_CLI_COMMAND；WSL 手動執行時用 orca-ide。
# 不要用裸 orca，那在 Linux 上是 GNOME 螢幕閱讀器。
ORCA="${ORCA_CLI_COMMAND:-orca-ide}"
if ! command -v "$ORCA" >/dev/null 2>&1; then
  log "找不到 Orca CLI（$ORCA）。先開 Orca app 或設 ORCA_CLI_COMMAND。"
  exit 1
fi

if ! "$ORCA" status --json >/dev/null 2>&1; then
  log "Orca 沒有回應。app 可能沒開，這輪跳過。"
  exit 0
fi

# 待派工的 issue 清單
if [ -n "$ONLY_ISSUE" ]; then
  issues_json=$(gh issue view "$ONLY_ISSUE" --json number,title | python3 -c 'import json,sys; print(json.dumps([json.load(sys.stdin)]))')
else
  issues_json=$(gh issue list --state open --label "$READY_LABEL" --limit 50 --json number,title)
fi

count=$(printf '%s' "$issues_json" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
if [ "$count" = "0" ]; then
  log "沒有 $READY_LABEL 的 issue，結束。"
  exit 0
fi
log "找到 $count 個待派 issue，這輪最多派 $LIMIT 個。"

# 已經有 worktree 綁著的 issue 號碼，避免重複派工
linked=$("$ORCA" worktree list --repo "$REPO_SELECTOR" --json 2>/dev/null \
  | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit
items = (d.get("result") or {}).get("worktrees") or []
nums = set()
for w in items:
    for key in ("linkedIssue", "issue"):
        v = w.get(key)
        if isinstance(v, dict):
            v = v.get("number")
        if isinstance(v, (int, str)) and str(v).strip():
            nums.add(str(v).strip())
print(" ".join(sorted(nums)))
' || printf '')
[ -n "$linked" ] && log "已綁 worktree 的 issue：$linked"

dispatched=0
while IFS=$'\t' read -r num title; do
  [ -z "${num:-}" ] && continue
  if [ "$dispatched" -ge "$LIMIT" ]; then
    log "已達本輪上限 $LIMIT，其餘留到下一輪。"
    break
  fi
  case " $linked " in
    *" $num "*) log "#$num 已有 worktree，跳過。"; continue ;;
  esac

  slug=$(printf '%s' "$title" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//' \
    | cut -c1-40)
  [ -z "$slug" ] && slug="task"
  wt_name="issue-${num}-${slug}"

  prompt="你在一個專為 GitHub issue #${num} 開的 worktree 裡工作。

第一步：用 Skill 工具呼叫 orca-issue-work，args 是 ${num}。
那個 skill 寫了完整流程：讀 issue、依 .kiro/steering/ 規範實作、自我驗證、commit、push、開 PR 連回 issue。

不要問我要不要開始，直接開始。資訊不足時在 issue 留言提問並加 orca-needs-info label，不要猜。"

  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] 會建 worktree $wt_name（issue #$num：$title）"
    dispatched=$((dispatched + 1))
    continue
  fi

  log "派工 #$num → worktree $wt_name"
  if create_out=$("$ORCA" worktree create \
        --repo "$REPO_SELECTOR" \
        --name "$wt_name" \
        --issue "$num" \
        --no-parent \
        --agent claude \
        --prompt "$prompt" \
        --comment "issue #${num} 自動派工" \
        --json 2>&1); then
    wt_id=$(printf '%s' "$create_out" | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); raise SystemExit
print(((d.get("result") or {}).get("worktree") or {}).get("id") or "")
' || printf '')
    log "建立成功：${wt_id:-（未取得 id）}"
    gh issue edit "$num" --add-label "$DISPATCHED_LABEL" --remove-label "$READY_LABEL" >/dev/null
    gh issue comment "$num" --body "🐋 Orca 已派工：worktree \`${wt_name}\`，Claude Code 開始處理。完成後會開 PR 連回本 issue。" >/dev/null
    dispatched=$((dispatched + 1))
  else
    log "#$num 派工失敗，label 保持 $READY_LABEL，下一輪再試。"
    log "$create_out"
  fi
done < <(printf '%s' "$issues_json" | python3 -c '
import json, sys
for it in json.load(sys.stdin):
    print("%s\t%s" % (it["number"], it["title"]))
')

log "本輪派出 $dispatched 個。"
