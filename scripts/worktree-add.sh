#!/bin/bash
# 用法: ./scripts/worktree-add.sh feat/my-feature

BRANCH=$1
DIRNAME=$(echo $BRANCH | sed 's/\//./')  # feat/auth → feat.auth
TARGET="../$(basename $(pwd)).$DIRNAME"

git worktree add -b $BRANCH $TARGET main

echo "✅ Worktree 建立完成: $TARGET"
echo "👉 進入目錄並安裝依賴..."

cd $TARGET && pnpm install
echo "🚀 完成！cd $TARGET"
