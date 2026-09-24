# 讓 Windows PowerShell 5.1 以 UTF-8 解讀 node 輸出，避免中文亂碼
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

node _dist/apps/crawler/main.js re-crawl="(location.like.台北市*,location.like.新北市*)"
