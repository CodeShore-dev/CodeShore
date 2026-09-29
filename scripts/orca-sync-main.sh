#!/usr/bin/env bash
# orca-sync-main.sh — PR 併進 main 後，把主 worktree 更新到最新的 main。
#
# dev server 跑在主 worktree，Vite 看到檔案變了就自己熱更新，所以這裡只要 git pull。
#
# 用法：
#   bash scripts/orca-sync-main.sh            # 同步
#   bash scripts/orca-sync-main.sh --dry-run  # 只講會做什麼
#
# 三個保護，任一個不成立就跳過並說明原因：
#   1. 目前分支必須是 main
#   2. 工作區必須乾淨（沒有未 commit 的改動）
#   3. pull 只允許 fast-forward
set -euo pipefail

ROOT="${ORCA_MAIN_WORKTREE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
MAIN_BRANCH="${ORCA_MAIN_BRANCH:-main}"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

log() { printf '[orca-sync-main] %s\n' "$*"; }

cd "$ROOT"

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "$MAIN_BRANCH" ]; then
  log "主 worktree 在 $branch，不是 $MAIN_BRANCH，跳過。要同步就先 git switch $MAIN_BRANCH。"
  exit 0
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  log "工作區有未 commit 的改動，跳過，不動你手上的東西。"
  git status --short --untracked-files=no | sed 's/^/[orca-sync-main]   /'
  exit 0
fi

before=$(git rev-parse HEAD)

if [ "$DRY_RUN" = "1" ]; then
  git fetch --quiet origin "$MAIN_BRANCH"
  target=$(git rev-parse "origin/$MAIN_BRANCH")
  if [ "$before" = "$target" ]; then
    log "[dry-run] 已經是最新的 $MAIN_BRANCH（$(git rev-parse --short HEAD)）。"
  else
    log "[dry-run] 會從 $(git rev-parse --short HEAD) 前進到 $(git rev-parse --short "origin/$MAIN_BRANCH")。"
  fi
  exit 0
fi

log "pull $MAIN_BRANCH（只允許 fast-forward）"
if ! git pull --ff-only --quiet origin "$MAIN_BRANCH"; then
  log "無法 fast-forward。本地 $MAIN_BRANCH 跟遠端分岔了，要手動處理。"
  exit 1
fi

after=$(git rev-parse HEAD)
if [ "$before" = "$after" ]; then
  log "已經是最新的（$(git rev-parse --short HEAD)），沒有變化。"
  exit 0
fi

log "更新完成：$(git rev-parse --short "$before") → $(git rev-parse --short "$after")"
git log --oneline "$before..$after" | sed 's/^/[orca-sync-main]   /'
log "Vite 會自己熱更新，瀏覽器不用手動重整。"
