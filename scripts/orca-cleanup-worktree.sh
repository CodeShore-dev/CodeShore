#!/usr/bin/env bash
# orca-cleanup-worktree.sh — PR 併掉之後，把那個 issue 的 Orca worktree 收掉。
#
# 用法：
#   bash scripts/orca-cleanup-worktree.sh --issue 23
#   bash scripts/orca-cleanup-worktree.sh --branch ChaoLiou/issue-23-104-cake
#   bash scripts/orca-cleanup-worktree.sh --all         # 掃所有 worktree，收掉已合併的
#   bash scripts/orca-cleanup-worktree.sh --all --dry-run
#
# 保護：只有在那個 issue 或分支的 PR 已經 merge 時才刪。找不到已合併的 PR 就跳過。
set -euo pipefail

ONLY_ISSUE=""
ONLY_BRANCH=""
ALL=0
DRY_RUN=0
FORCE="${ORCA_CLEANUP_FORCE:-0}"

while [ $# -gt 0 ]; do
  case "$1" in
    --issue) ONLY_ISSUE="$2"; shift 2 ;;
    --branch) ONLY_BRANCH="$2"; shift 2 ;;
    --all) ALL=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

log() { printf '[orca-cleanup] %s\n' "$*"; }

ORCA="${ORCA_CLI_COMMAND:-orca-ide}"
if ! command -v "$ORCA" >/dev/null 2>&1; then
  for candidate in /mnt/c/Users/*/AppData/Roaming/orca/wsl-managed-cli/*/orca-ide; do
    [ -x "$candidate" ] && ORCA="$candidate" && break
  done
fi
if ! command -v "$ORCA" >/dev/null 2>&1; then
  log "找不到 Orca CLI。"
  exit 1
fi
if ! "$ORCA" status --json >/dev/null 2>&1; then
  log "Orca 沒有回應，app 可能沒開，跳過。"
  exit 0
fi

REPO_SELECTOR="${ORCA_REPO_SELECTOR:-name:CodeShore}"
MAIN_BRANCH="${ORCA_MAIN_BRANCH:-main}"

# Orca 回的分支是 refs/heads/<name> 全名，gh 要短名。
short_branch() {
  printf '%s' "${1#refs/heads/}"
}

# 這個分支的 PR 是不是已經 merge 了
branch_merged() {
  local branch state
  branch=$(short_branch "$1")
  state=$(gh pr list --state merged --head "$branch" --limit 1 --json number -q '.[0].number' 2>/dev/null || printf '')
  [ -n "$state" ]
}

# 這個 issue 的 PR 是不是已經 merge 了。先看 issue 有沒有 orca-in-pr 以外的線索，
# 直接用 gh pr list 掃分支名含 issue-<N>- 的 PR。
issue_merged_branch() {
  local num="$1"
  gh pr list --state merged --limit 100 --json number,headRefName \
    -q ".[] | select(.headRefName | test(\"issue-${num}(-|$)\")) | .headRefName" 2>/dev/null | head -1
}

remove_worktree() {
  local selector="$1" label="$2"
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] 會刪 $label（selector: $selector）"
    return 0
  fi
  local args=(worktree rm --worktree "$selector" --json)
  [ "$FORCE" = "1" ] && args+=(--force)
  if out=$("$ORCA" "${args[@]}" 2>&1); then
    log "已刪掉 $label"
  else
    log "刪 $label 失敗，保留原狀：$out"
    return 1
  fi
}

if [ -n "$ONLY_BRANCH" ]; then
  if branch_merged "$ONLY_BRANCH"; then
    remove_worktree "branch:$(short_branch "$ONLY_BRANCH")" "$(short_branch "$ONLY_BRANCH")"
  else
    log "$ONLY_BRANCH 沒有已合併的 PR，跳過。"
  fi
  exit 0
fi

if [ -n "$ONLY_ISSUE" ]; then
  branch=$(issue_merged_branch "$ONLY_ISSUE")
  if [ -n "$branch" ]; then
    remove_worktree "issue:$ONLY_ISSUE" "issue #$ONLY_ISSUE（$branch）"
  else
    log "issue #$ONLY_ISSUE 沒有已合併的 PR，跳過。"
  fi
  exit 0
fi

if [ "$ALL" != "1" ]; then
  log "要給 --issue、--branch 或 --all。"
  exit 2
fi

# --all：列出 Orca worktree，逐個看分支的 PR 有沒有 merge
mapfile -t rows < <("$ORCA" worktree list --repo "$REPO_SELECTOR" --json 2>/dev/null | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit
for w in (d.get("result") or {}).get("worktrees") or []:
    branch = w.get("branch") or ""
    name = w.get("displayName") or w.get("name") or ""
    if branch:
        print("%s\t%s" % (branch, name))
')

if [ "${#rows[@]}" = "0" ]; then
  log "Orca 沒有列出任何 worktree。"
  exit 0
fi

removed=0
for row in "${rows[@]}"; do
  branch="${row%%$'\t'*}"
  name="${row##*$'\t'}"
  if [ "$(short_branch "$branch")" = "$MAIN_BRANCH" ]; then
    log "跳過主 worktree（$MAIN_BRANCH）。"
    continue
  fi
  if branch_merged "$branch"; then
    if remove_worktree "branch:$(short_branch "$branch")" "$name（$(short_branch "$branch")）"; then
      removed=$((removed + 1))
    fi
  else
    log "$name 的分支 $branch 還沒合併，保留。"
  fi
done
log "收掉 $removed 個。"
