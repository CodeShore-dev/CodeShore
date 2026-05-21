#!/bin/bash
set -e  # 任何錯誤就停止

echo -e "\033[36m🚀 開始設定專案環境...\033[0m"

# 1. 檢查必要工具
for tool in git node pnpm; do
    if ! command -v $tool &> /dev/null; then
        echo -e "\033[31m❌ 找不到 $tool，請先安裝\033[0m"
        exit 1
    fi
done
echo -e "\033[32m✅ 工具檢查完成\033[0m"

# 2. git 基本設定
git config core.longpaths true
git config core.autocrlf input  # bash 環境用 input，不是 true
echo -e "\033[32m✅ git 設定完成\033[0m"

# 3. 安裝依賴
echo "📦 安裝依賴中..."
pnpm install
echo -e "\033[32m✅ 依賴安裝完成\033[0m"

# 4. 建立 .code-workspace（不進 git，本機專用）
CURRENT_DIR=$(pwd)
PARENT_DIR=$(dirname "$CURRENT_DIR")
PROJECT_NAME=$(basename "$CURRENT_DIR")
WORKSPACE_FILE="$PARENT_DIR/$PROJECT_NAME.code-workspace"

if [ ! -f "$WORKSPACE_FILE" ]; then
    cat > "$WORKSPACE_FILE" << EOF
{
  "folders": [
    { "name": "main", "path": "./$PROJECT_NAME" }
  ]
}
EOF
    echo -e "\033[32m✅ 建立 $PROJECT_NAME.code-workspace\033[0m"
else
    echo -e "\033[33m⏭️  .code-workspace 已存在，跳過\033[0m"
fi

# 5. 設定 pnpm store（共用）
pnpm config set store-dir "$HOME/.pnpm-store"
echo -e "\033[32m✅ pnpm store 設定完成\033[0m"

echo ""
echo -e "\033[36m🎉 設定完成！\033[0m"
echo "👉 開啟 VSCode: code $WORKSPACE_FILE"
