#!/usr/bin/env bash
# orca-sync-main.sh — PR 併進 main 後，把主 worktree 更新到最新的 main。
#
# dev server 跑在主 worktree：
#   Vite（前端）看到檔案變了就熱更新，不用重啟。
#   nx serve backend（NestJS）的 watch 會重 build 並重啟 node process。
# 兩邊都靠檔案變動觸發，所以這裡主要工作是 git pull。
#
# 例外是依賴：pnpm-lock.yaml 變了就要重裝，watch 不會幫你裝，
# 後端會用舊的 node_modules 重啟然後失敗。所以這支腳本會自己跑 pnpm install。
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
LOCKFILE="${ORCA_LOCKFILE:-pnpm-lock.yaml}"
INSTALL_CMD="${ORCA_INSTALL_CMD:-pnpm install --frozen-lockfile}"
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

# 依賴變了就重裝。dev server 的 watch 只看程式碼，不管 node_modules。
if git diff --name-only "$before" "$after" | grep -qx "$LOCKFILE"; then
  log "$LOCKFILE 有變動，跑 $INSTALL_CMD"
  if $INSTALL_CMD; then
    log "套件安裝完成。"
  else
    log "套件安裝失敗。dev server 可能會用舊的 node_modules 重啟並失敗，要手動處理。"
    exit 1
  fi
else
  log "$LOCKFILE 沒變，不用重裝套件。"
fi

log "前端由 Vite 熱更新；後端由 nx serve 的 watch 重 build 並重啟，會斷幾秒。"
