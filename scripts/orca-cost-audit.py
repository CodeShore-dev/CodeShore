#!/usr/bin/env python3
"""orca-cost-audit.py — 從 worker 的 Claude Code transcript 算每張 issue 的成本與 SOP 合規。

這是 /orca-retro 的訊號 D。另外三種訊號都要「人出手了」或「worker 卡住了」才會響，
但「東西能動、只是在燒錢」不會讓任何人出手——那種問題只有數字看得到。

用法：
  python3 scripts/orca-cost-audit.py              # 第一階段：表格 + 標出離群
  python3 scripts/orca-cost-audit.py --dive 27    # 第二階段：那一張到底在幹嘛
  python3 scripts/orca-cost-audit.py --json       # 給別的腳本吃

環境變數：
  ORCA_PROJECTS_DIR  Claude Code transcript 根目錄，預設 ~/.claude/projects
  ORCA_WORKTREE_TAG  worktree 專案目錄的前綴，預設依 repo 名推出來

為什麼用 tokens/行而不是 tokens：絕對值跟 issue 大小綁死，比不了。實測改最多行的那張
反而最省（PR#26：463 行、3.3k/行），所以「大 issue 比較貴」是錯的直覺。

為什麼不看時間：transcript 的 wall time 含排隊等待。PR#28 的 111 分鐘裡有 98.5 分鐘是
queue-operation，worker 根本沒在跑。只看 token。
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import statistics
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECTS = Path(os.environ.get("ORCA_PROJECTS_DIR", Path.home() / ".claude" / "projects"))
REPO_ROOT = Path(__file__).resolve().parent.parent
# worker 一定要跑的 skill（orca-issue-work Step 6 / 硬規則 7）
REQUIRED_SKILLS = {"orca-issue-work", "kiro-review", "kiro-verify-completion"}
OUTLIER_FACTOR = 2.5  # 中位數的幾倍算離群。樣本還少，不要寫死絕對值。
CACHE_READ_WEIGHT = 10  # cache read 的計價大約是一般 input 的 1/10


def log(msg: str) -> None:
    print(msg, file=sys.stderr)


def worktree_dirs(tag: str) -> list[Path]:
    """列出 worker worktree 的 transcript 目錄。目錄名是路徑轉成的 slug。"""
    return sorted(d for d in PROJECTS.glob(f"{tag}*") if d.is_dir())


def issue_number(dirname: str, tag: str) -> int | None:
    m = re.search(r"issue-(\d+)", dirname[len(tag) :])
    return int(m.group(1)) if m else None


def scan(d: Path) -> dict:
    """讀一個 worktree 的所有 jsonl，統計 token、工具、skill、回合、context 曲線。"""
    usage: collections.Counter[str] = collections.Counter()
    tools: collections.Counter[str] = collections.Counter()
    skills: list[str] = []
    stamps: list[str] = []
    ctx: list[int] = []
    results: list[tuple[int, str]] = []
    commands: collections.Counter[str] = collections.Counter()
    turns = 0

    for f in d.glob("*.jsonl"):
        for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                j = json.loads(line)
            except ValueError:
                continue
            if j.get("timestamp"):
                stamps.append(j["timestamp"])
            if j.get("type") == "assistant":
                turns += 1
            msg = j.get("message") or {}
            u = msg.get("usage") or {}
            for k, v in u.items():
                if isinstance(v, int):
                    usage[k] += v
            if u.get("cache_read_input_tokens"):
                ctx.append(u["cache_read_input_tokens"] + u.get("cache_creation_input_tokens", 0))
            content = msg.get("content")
            if not isinstance(content, list):
                continue
            for b in content:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "tool_use":
                    name = b.get("name") or "?"
                    tools[name] += 1
                    inp = b.get("input") or {}
                    if name == "Skill":
                        skills.append(str(inp.get("skill")))
                    elif name == "Bash":
                        commands[str(inp.get("command", ""))[:90]] += 1
                elif b.get("type") == "tool_result":
                    s = b.get("content")
                    s = s if isinstance(s, str) else json.dumps(s, ensure_ascii=False)
                    results.append((len(s), s[:110].replace("\n", " ")))

    eff = (
        usage["cache_creation_input_tokens"]
        + usage["input_tokens"]
        + usage["output_tokens"]
        + usage["cache_read_input_tokens"] // CACHE_READ_WEIGHT
    )
    stamps.sort()
    ctx.sort()
    return {
        "eff_tokens": eff,
        "turns": turns,
        "tools": tools,
        "skills": skills,
        "stamps": stamps,
        "ctx": ctx,
        "results": results,
        "commands": commands,
    }


def pr_stats() -> dict[int, dict]:
    """抓每個 PR 的改動行數，並從內文的 `Closes #N` 對回 issue。"""
    try:
        out = subprocess.run(
            ["gh", "pr", "list", "--state", "all", "--limit", "60",
             "--json", "number,additions,deletions,changedFiles,body,title"],
            cwd=REPO_ROOT, capture_output=True, text=True, timeout=60, check=True,
        ).stdout
    except (subprocess.SubprocessError, FileNotFoundError) as exc:
        log(f"[warn] 拿不到 PR 清單（{exc}），只好沒有行數：tokens/行 會空白。")
        return {}
    by_issue: dict[int, dict] = {}
    for pr in json.loads(out):
        for n in re.findall(r"(?:Closes|Fixes|Resolves)\s+#(\d+)", pr.get("body") or "", re.I):
            by_issue[int(n)] = {
                "pr": pr["number"],
                "lines": pr["additions"] + pr["deletions"],
                "files": pr["changedFiles"],
                "title": pr["title"],
            }
    return by_issue


def collect(tag: str) -> list[dict]:
    prs = pr_stats()
    rows = []
    for d in worktree_dirs(tag):
        n = issue_number(d.name, tag)
        if n is None:
            continue
        s = scan(d)
        if not s["stamps"]:
            continue
        pr = prs.get(n, {})
        lines = pr.get("lines")
        rows.append({
            "issue": n,
            "dir": str(d),
            "pr": pr.get("pr"),
            "title": pr.get("title", ""),
            "lines": lines,
            "eff_tokens": s["eff_tokens"],
            "per_line": (s["eff_tokens"] / lines) if lines else None,
            "turns": s["turns"],
            "skills": s["skills"],
            "missing_skills": sorted(REQUIRED_SKILLS - set(s["skills"])),
        })
    return rows


def stage1(rows: list[dict], as_json: bool) -> int:
    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print("沒有找到 worker transcript。worktree 還沒跑過，或 ORCA_PROJECTS_DIR 不對。")
        return 0

    per = [r["per_line"] for r in rows if r["per_line"]]
    cut = statistics.median(per) * OUTLIER_FACTOR if per else None

    print(f"{'issue':>6s} {'PR':>5s} {'行':>6s} {'等效tok':>9s} {'tok/行':>8s} {'回合':>5s}  SOP")
    for r in sorted(rows, key=lambda r: r["per_line"] or 0):
        pl = f"{r['per_line']/1000:7.1f}k" if r["per_line"] else "      —"
        flag = " ⚠" if cut and r["per_line"] and r["per_line"] > cut else ""
        sop = "✓" if not r["missing_skills"] else "✗ 少跑 " + "、".join(r["missing_skills"])
        print(f"{r['issue']:6d} {str(r['pr'] or '—'):>5s} {str(r['lines'] or '—'):>6s} "
              f"{r['eff_tokens']/1000:8.0f}k {pl}{flag} {r['turns']:5d}  {sop}")

    print()
    if cut:
        print(f"離群線：中位數 × {OUTLIER_FACTOR} = {cut/1000:.1f}k tok/行")
    hot = [r for r in rows if cut and r["per_line"] and r["per_line"] > cut]
    bad = [r for r in rows if r["missing_skills"]]
    for r in hot:
        print(f"⚠ #{r['issue']} 成本離群 → python3 scripts/orca-cost-audit.py --dive {r['issue']}")
    for r in bad:
        print(f"✗ #{r['issue']} 沒照 SOP：少跑 {'、'.join(r['missing_skills'])}")
    if not hot and not bad:
        print("沒有離群，也沒有漏跑的 skill。")
    return 0


def stage2(tag: str, issue: int) -> int:
    dirs = [d for d in worktree_dirs(tag) if issue_number(d.name, tag) == issue]
    if not dirs:
        log(f"找不到 issue #{issue} 的 transcript。")
        return 1
    s = scan(dirs[0])
    ctx = s["ctx"]
    stamps = s["stamps"]
    span = (
        datetime.fromisoformat(stamps[-1].replace("Z", "+00:00"))
        - datetime.fromisoformat(stamps[0].replace("Z", "+00:00"))
    ).total_seconds() / 60

    print(f"issue #{issue}　{dirs[0].name}")
    print(f"等效 token {s['eff_tokens']/1000:.0f}k　回合 {s['turns']}　"
          f"牆鐘 {span:.0f} 分（含排隊，不要拿來判斷慢不慢）")
    if ctx:
        print(f"context：起 {ctx[0]/1000:.0f}k → 中位 {ctx[len(ctx)//2]/1000:.0f}k → 尾 {ctx[-1]/1000:.0f}k")
    print(f"skills：{'、'.join(s['skills']) or '無'}")

    print("\n工具呼叫：")
    for k, v in s["tools"].most_common(8):
        print(f"  {v:4d}  {k}")

    rep = [(v, k) for k, v in s["commands"].items() if v > 1]
    if rep:
        print("\n重複跑的指令（試了幾次才對）：")
        for v, k in sorted(rep, reverse=True)[:8]:
            print(f"  {v:3d}×  {k}")

    print("\n最大的 tool 回傳：")
    for n, snippet in sorted(s["results"], reverse=True)[:6]:
        print(f"  {n/1000:6.1f}k chars  {snippet}")

    print("\n讀法：單筆回傳都不大但 context 一路漲 → 問題在回合數，不在哪一次讀太多。")
    print("想知道那些回合在幹嘛，照時間列出工具呼叫：")
    print(f"  python3 scripts/orca-cost-audit.py --timeline {issue}")
    return 0


def timeline(tag: str, issue: int) -> int:
    dirs = [d for d in worktree_dirs(tag) if issue_number(d.name, tag) == issue]
    if not dirs:
        log(f"找不到 issue #{issue} 的 transcript。")
        return 1
    ev = []
    for f in dirs[0].glob("*.jsonl"):
        for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                j = json.loads(line)
            except ValueError:
                continue
            if j.get("timestamp"):
                ev.append(j)
    ev.sort(key=lambda j: j["timestamp"])
    i = 0
    for j in ev:
        content = (j.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for b in content:
            if isinstance(b, dict) and b.get("type") == "tool_use":
                i += 1
                inp = b.get("input") or {}
                s = inp.get("command") or inp.get("file_path") or inp.get("skill") or inp.get("pattern") or ""
                print(f"{i:4d} {j['timestamp'][11:19]} {b.get('name'):10s} {str(s)[:95]}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dive", type=int, metavar="ISSUE", help="第二階段：細看那一張")
    ap.add_argument("--timeline", type=int, metavar="ISSUE", help="照時間列出所有工具呼叫")
    ap.add_argument("--json", action="store_true", help="第一階段輸出 JSON")
    args = ap.parse_args()

    default_tag = "-" + str(Path.home() / "orca" / "workspaces" / REPO_ROOT.name).lstrip("/").replace("/", "-") + "-"
    tag = os.environ.get("ORCA_WORKTREE_TAG", default_tag)

    if args.timeline:
        return timeline(tag, args.timeline)
    if args.dive:
        return stage2(tag, args.dive)
    return stage1(collect(tag), args.json)


if __name__ == "__main__":
    sys.exit(main())
