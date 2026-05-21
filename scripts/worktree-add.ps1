# scripts/worktree-add.ps1
param([string]$Branch)

$DirName = $Branch -replace "/", "."
$ParentDir = Split-Path (Get-Location) -Parent
$ProjectName = Split-Path (Get-Location) -Leaf
$Target = "$ParentDir\$ProjectName.$DirName"

git worktree add -b $Branch $Target main

Write-Host "✅ Worktree 建立完成: $Target"
Write-Host "👉 安裝依賴..."

Set-Location $Target
pnpm install

Write-Host "🚀 完成！"
