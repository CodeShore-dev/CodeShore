#!/usr/bin/env bash
# orca-lib.sh — orca-* 腳本共用的小工具。用 `source` 載入，不要直接執行。
#
# 為什麼存在：listener 是 systemd user service，PATH 只有
# /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin，
# 沒有 ~/.local/bin。所以從 webhook 派出去的任何 `claude` 都會是 exit 127
# （PR #31 的預審就是這樣失敗的，而且它在 log 裡才看得到，PR 上完全沒有訊號）。
#
# 這跟 orca-webhook.sh 裡解 WSL_INTEROP 與 ORCA_CLI_COMMAND 是同一類問題：
# 服務環境沒有互動式 shell 的那些變數，要自己解。

# resolve_claude — 印出 claude 執行檔的絕對路徑，找不到就 exit 1。
#
# 不要寫死 ~/.local/share/claude/versions/<版號>：那是 ~/.local/bin/claude 的
# symlink 目標，升級就換一個目錄。要走 symlink。
resolve_claude() {
  if [ -n "${ORCA_CLAUDE_BIN:-}" ] && [ -x "${ORCA_CLAUDE_BIN}" ]; then
    printf '%s\n' "$ORCA_CLAUDE_BIN"
    return 0
  fi
  local found
  found=$(command -v claude 2>/dev/null || true)
  if [ -n "$found" ]; then
    printf '%s\n' "$found"
    return 0
  fi
  local candidate
  for candidate in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "找不到 claude 執行檔。設 ORCA_CLAUDE_BIN 指過去，或把它放進 PATH。" >&2
  return 1
}
