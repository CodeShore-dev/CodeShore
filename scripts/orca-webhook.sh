#!/usr/bin/env bash
# orca-webhook.sh — 事件驅動派工。貼上 orca-ready label 後幾秒內就派工，不用輪詢。
#
# 做兩件事：
#   1. 起本機 listener（scripts/orca-webhook-listener.py）
#   2. 跑 gh webhook forward，把 repo 的 issues 事件轉到那個 listener
#
# 用法：
#   bash scripts/orca-webhook.sh              # 前景跑，Ctrl-C 結束
#   systemctl --user start orca-webhook       # 背景常駐（見 docs 或 README）
#
# 前提：Orca app 要開著、gh 要登入且對 repo 有 admin 權限。
set -euo pipefail

REPO="${ORCA_WEBHOOK_REPO:-CodeShore-dev/CodeShore}"
PORT="${ORCA_WEBHOOK_PORT:-9099}"
ENV_FILE="${ORCA_WEBHOOK_ENV_FILE:-$HOME/.config/orca-webhook/env}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '[orca-webhook.sh] %s\n' "$*"; }

# WSL interop socket：orca-ide 要靠它叫 Windows 的 orca.exe。systemd 服務沒有這個變數。
if [ -z "${WSL_INTEROP:-}" ] || [ ! -S "${WSL_INTEROP:-}" ]; then
  newest=$(ls -t /run/WSL/*_interop 2>/dev/null | head -1 || true)
  if [ -n "$newest" ]; then
    export WSL_INTEROP="$newest"
    log "WSL_INTEROP：$newest"
  else
    log "找不到 WSL interop socket。orca-ide 會失敗，先開一個 WSL 終端再跑。"
  fi
fi

# Orca 的 CLI 路徑由 Orca 管理的 shell 注入，systemd 服務裡沒有，所以自己 glob。
if [ -z "${ORCA_CLI_COMMAND:-}" ]; then
  for candidate in /mnt/c/Users/*/AppData/Roaming/orca/wsl-managed-cli/*/orca-ide; do
    if [ -x "$candidate" ]; then
      ORCA_CLI_COMMAND="$candidate"
      break
    fi
  done
fi
if [ -z "${ORCA_CLI_COMMAND:-}" ]; then
  log "找不到 orca-ide。Orca app 沒裝或路徑變了，先設 ORCA_CLI_COMMAND。"
  exit 1
fi
export ORCA_CLI_COMMAND
log "Orca CLI：$ORCA_CLI_COMMAND"

# webhook secret：第一次跑自動產生並存起來，之後兩邊共用同一個值。
mkdir -p "$(dirname "$ENV_FILE")"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi
if [ -z "${ORCA_WEBHOOK_SECRET:-}" ]; then
  ORCA_WEBHOOK_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  printf 'ORCA_WEBHOOK_SECRET=%s\n' "$ORCA_WEBHOOK_SECRET" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "產生新的 webhook secret，存到 $ENV_FILE"
fi
export ORCA_WEBHOOK_SECRET
export ORCA_WEBHOOK_PORT="$PORT"

listener_pid=""
cleanup() {
  if [ -n "$listener_pid" ] && kill -0 "$listener_pid" 2>/dev/null; then
    kill "$listener_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

python3 "$ROOT/scripts/orca-webhook-listener.py" &
listener_pid=$!
log "listener pid $listener_pid，port $PORT"

# 等 listener 真的接受連線再開 forward，不然前幾個事件會掉。
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then
    break
  fi
  sleep 0.2
done
if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then
  log "listener 沒起來，放棄。"
  exit 1
fi

log "開 gh webhook forward → $REPO（events: issues, pull_request）"
exec gh webhook forward \
  --events=issues,pull_request \
  --repo="$REPO" \
  --url="http://127.0.0.1:$PORT/webhooks" \
  --secret="$ORCA_WEBHOOK_SECRET"
