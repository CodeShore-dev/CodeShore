#!/usr/bin/env python3
"""orca-webhook-listener.py — 接 gh webhook forward 轉來的 GitHub 事件，即時反應。

處理兩種事件：
  issues.labeled（label 是 orca-ready）→ 跑 scripts/orca-dispatch.sh --issue <號碼>
  pull_request.opened / ready_for_review → 跑 scripts/orca-review-dispatch.sh --pr <號碼>，
    用一個乾淨 session 預審並貼 orca-review-clean / orca-review-flagged
  pull_request.closed（已 merge 進 main）→ 依序跑兩件事：
    1. scripts/orca-sync-main.sh，讓主 worktree 的 dev server 更新到合併後的版本
    2. scripts/orca-cleanup-worktree.sh --branch <PR 分支>，收掉那個 worker worktree

用法：
  python3 scripts/orca-webhook-listener.py            # 聽 127.0.0.1:9099
  ORCA_WEBHOOK_PORT=9100 python3 scripts/...          # 換 port

環境變數：
  ORCA_WEBHOOK_PORT    監聽 port，預設 9099
  ORCA_WEBHOOK_SECRET  設了就驗 X-Hub-Signature-256，要與 gh webhook forward --secret 一致
  ORCA_READY_LABEL     觸發派工的 label，預設 orca-ready
  ORCA_MAIN_BRANCH     要同步的分支，預設 main
  ORCA_SYNC_ON_MERGE   設成 0 就不在 merge 後同步主 worktree
  ORCA_CLEANUP_ON_MERGE 設成 0 就不在 merge 後收掉 worker worktree
  ORCA_REVIEW_ON_OPEN  設成 0 就不在 PR 開啟時派預審
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DISPATCH = REPO_ROOT / "scripts" / "orca-dispatch.sh"
SYNC = REPO_ROOT / "scripts" / "orca-sync-main.sh"
CLEANUP = REPO_ROOT / "scripts" / "orca-cleanup-worktree.sh"
REVIEW = REPO_ROOT / "scripts" / "orca-review-dispatch.sh"
PORT = int(os.environ.get("ORCA_WEBHOOK_PORT", "9099"))
SECRET = os.environ.get("ORCA_WEBHOOK_SECRET", "")
READY_LABEL = os.environ.get("ORCA_READY_LABEL", "orca-ready")
MAIN_BRANCH = os.environ.get("ORCA_MAIN_BRANCH", "main")
SYNC_ON_MERGE = os.environ.get("ORCA_SYNC_ON_MERGE", "1") != "0"
CLEANUP_ON_MERGE = os.environ.get("ORCA_CLEANUP_ON_MERGE", "1") != "0"
REVIEW_ON_OPEN = os.environ.get("ORCA_REVIEW_ON_OPEN", "1") != "0"

_lock = threading.Lock()
_inflight: set[int] = set()
_sync_lock = threading.Lock()


def log(msg: str) -> None:
    stamp = datetime.now().strftime("%H:%M:%S")
    print(f"[orca-webhook {stamp}] {msg}", flush=True)


def signature_ok(body: bytes, header: str | None) -> bool:
    if not SECRET:
        return True
    if not header:
        return False
    digest = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={digest}", header)


def wsl_interop_env() -> dict[str, str]:
    """回傳帶有可用 WSL_INTEROP 的環境。

    orca-ide 會透過 PowerShell 叫 Windows 的 orca.exe，沒有 interop socket 就失敗。
    systemd 服務沒有這個變數，而且 socket 每個 WSL session 都不同，所以每次派工前重找。
    """
    env = dict(os.environ)
    current = env.get("WSL_INTEROP", "")
    if current and Path(current).is_socket():
        return env
    sockets = sorted(
        Path("/run/WSL").glob("*_interop"),
        key=lambda s: s.stat().st_mtime,
        reverse=True,
    )
    for sock in sockets:
        if sock.is_socket():
            env["WSL_INTEROP"] = str(sock)
            log(f"改用 interop socket：{sock}")
            return env
    log("找不到 WSL interop socket，orca-ide 可能會失敗。")
    return env


def dispatch(number: int) -> None:
    """跑一次派工。已在處理中的 issue 不重複跑。"""
    with _lock:
        if number in _inflight:
            log(f"#{number} 已在派工中，忽略這次事件。")
            return
        _inflight.add(number)
    try:
        log(f"#{number} 開始派工。")
        proc = subprocess.run(
            ["bash", str(DISPATCH), "--issue", str(number)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=600,
            env=wsl_interop_env(),
        )
        for line in (proc.stdout or "").splitlines():
            log(f"#{number} | {line}")
        for line in (proc.stderr or "").splitlines():
            log(f"#{number} ! {line}")
        log(f"#{number} 派工結束，exit={proc.returncode}")
    except subprocess.TimeoutExpired:
        log(f"#{number} 派工超過 600 秒，放棄這次。")
    except Exception as exc:  # noqa: BLE001
        log(f"#{number} 派工丟出例外：{exc}")
    finally:
        with _lock:
            _inflight.discard(number)


def review_pr(number: int) -> None:
    """PR 一開就派一個乾淨 session 預審。失敗不影響 PR，使用者照常自己 review。"""
    if not REVIEW.exists():
        log("找不到預審腳本，跳過。")
        return
    try:
        proc = subprocess.run(
            ["bash", str(REVIEW), "--pr", str(number)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=900,
        )
        for line in (proc.stdout or "").splitlines():
            log(f"PR #{number} | {line}")
        for line in (proc.stderr or "").splitlines():
            log(f"PR #{number} ! {line}")
        log(f"PR #{number} 預審結束，exit={proc.returncode}")
    except subprocess.TimeoutExpired:
        log(f"PR #{number} 預審超過 900 秒，放棄這次。")
    except Exception as exc:  # noqa: BLE001
        log(f"PR #{number} 預審丟出例外：{exc}")


def cleanup_worktree(branch: str, pr_number: int) -> None:
    """PR 併掉後收掉那個 worker worktree。腳本自己會確認 PR 真的合併了。"""
    if not CLEANUP.exists():
        log("找不到清理腳本，跳過收 worktree。")
        return
    try:
        proc = subprocess.run(
            ["bash", str(CLEANUP), "--branch", branch],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=300,
            env=wsl_interop_env(),
        )
        for line in (proc.stdout or "").splitlines():
            log(f"cleanup | {line}")
        for line in (proc.stderr or "").splitlines():
            log(f"cleanup ! {line}")
        log(f"收 worktree 結束，exit={proc.returncode}")
    except subprocess.TimeoutExpired:
        log(f"PR #{pr_number}：收 worktree 超過 300 秒，放棄這次。")
    except Exception as exc:  # noqa: BLE001
        log(f"PR #{pr_number}：收 worktree 丟出例外：{exc}")


def sync_main(pr_number: int, branch: str = "") -> None:
    """PR 併進 main 後，更新主 worktree，然後收掉 worker worktree。一次只跑一個。"""
    if not _sync_lock.acquire(blocking=False):
        log(f"PR #{pr_number}：已經在同步，忽略這次事件。")
        return
    try:
        if not SYNC_ON_MERGE:
            log(f"PR #{pr_number} 已 merge → 同步已關閉，只收 worktree。")
            if branch and CLEANUP_ON_MERGE:
                cleanup_worktree(branch, pr_number)
            return
        log(f"PR #{pr_number} 已 merge → 同步主 worktree。")
        proc = subprocess.run(
            ["bash", str(SYNC)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=300,
        )
        for line in (proc.stdout or "").splitlines():
            log(f"sync | {line}")
        for line in (proc.stderr or "").splitlines():
            log(f"sync ! {line}")
        log(f"同步結束，exit={proc.returncode}")
        if branch and CLEANUP_ON_MERGE:
            cleanup_worktree(branch, pr_number)
    except subprocess.TimeoutExpired:
        log("同步超過 300 秒，放棄這次。")
    except Exception as exc:  # noqa: BLE001
        log(f"同步丟出例外：{exc}")
    finally:
        _sync_lock.release()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:  # 關掉預設的每請求一行
        pass

    def _reply(self, code: int, text: str = "ok") -> None:
        payload = text.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        self._reply(200, "orca-webhook-listener alive")

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""

        if not signature_ok(body, self.headers.get("X-Hub-Signature-256")):
            log("簽章不符，丟棄這個請求。")
            self._reply(401, "bad signature")
            return

        event = self.headers.get("X-GitHub-Event", "")
        try:
            payload = json.loads(body or b"{}")
        except json.JSONDecodeError:
            self._reply(400, "bad json")
            return

        self._reply(202, "accepted")

        if event == "pull_request":
            self._on_pull_request(payload)
            return
        if event != "issues":
            return
        if payload.get("action") != "labeled":
            return

        label = (payload.get("label") or {}).get("name")
        if label != READY_LABEL:
            return

        number = (payload.get("issue") or {}).get("number")
        if not isinstance(number, int):
            log("事件裡沒有 issue 號碼，忽略。")
            return

        log(f"收到 issues.labeled（{label}）→ #{number}")
        threading.Thread(target=dispatch, args=(number,), daemon=True).start()

    def _on_pull_request(self, payload: dict) -> None:
        action = payload.get("action")
        number = (payload.get("pull_request") or {}).get("number")

        # PR 一開（或 draft 轉正）就派一個乾淨 session 預審。worker 自己跑的 kiro-review
        # 在它自己的 context 裡，篩不掉自己的盲點，所以這裡要換一雙眼睛。
        if action in ("opened", "ready_for_review") and REVIEW_ON_OPEN and isinstance(number, int):
            log(f"收到 pull_request.{action} → #{number}，派預審。")
            threading.Thread(target=review_pr, args=(number,), daemon=True).start()
            return

        if not SYNC_ON_MERGE and not CLEANUP_ON_MERGE:
            return
        if action != "closed":
            return
        pr = payload.get("pull_request") or {}
        if not pr.get("merged"):
            log("PR 關掉但沒 merge，不同步。")
            return
        base = ((pr.get("base") or {}).get("ref")) or ""
        if base != MAIN_BRANCH:
            log(f"PR 併進 {base}，不是 {MAIN_BRANCH}，不同步。")
            return
        number = pr.get("number")
        if not isinstance(number, int):
            return
        head = ((pr.get("head") or {}).get("ref")) or ""
        threading.Thread(target=sync_main, args=(number, head), daemon=True).start()


def main() -> int:
    if not DISPATCH.exists():
        log(f"找不到派工腳本：{DISPATCH}")
        return 1
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    log(f"聽 http://127.0.0.1:{PORT}/ ，觸發 label：{READY_LABEL}")
    log("簽章驗證：" + ("開啟" if SECRET else "關閉（沒設 ORCA_WEBHOOK_SECRET）"))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("收到中斷，結束。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
