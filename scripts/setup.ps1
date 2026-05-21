Write-Host "🚀 開始設定專案環境..." -ForegroundColor Cyan

# 1. 檢查必要工具
$tools = @("git", "node", "pnpm")
foreach ($tool in $tools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "❌ 找不到 $tool，請先安裝" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ 工具檢查完成" -ForegroundColor Green

# 2. git 基本設定
git config core.longpaths true
git config core.autocrlf true
Write-Host "✅ git 設定完成" -ForegroundColor Green

# 3. 安裝依賴
Write-Host "📦 安裝依賴中..."
pnpm install
Write-Host "✅ 依賴安裝完成" -ForegroundColor Green

# 4. 建立 .code-workspace（不進 git，本機專用）
$ParentDir = Split-Path (Get-Location) -Parent
$ProjectName = Split-Path (Get-Location) -Leaf
$WorkspaceFile = "$ParentDir\$ProjectName.code-workspace"

if (-not (Test-Path $WorkspaceFile)) {
    $Workspace = @{
        folders = @(
            @{ name = "main"; path = ".\$ProjectName" }
        )
    }
    $Workspace | ConvertTo-Json -Depth 10 | Set-Content $WorkspaceFile
    Write-Host "✅ 建立 $ProjectName.code-workspace" -ForegroundColor Green
} else {
    Write-Host "⏭️  .code-workspace 已存在，跳過" -ForegroundColor Yellow
}

# 5.
