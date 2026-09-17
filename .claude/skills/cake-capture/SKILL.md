---
name: cake-capture
description: Capture all Cake.me job listing pages via browser automation and produce a cake-handoff.json ready for crawl-from-file ingestion.
allowed-tools: Read, Glob, Bash, PowerShell, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__read_console_messages
argument-hint: [cake-jobs-url]
---

# cake-capture

## Overview

Uses Claude-in-Chrome browser automation to fetch all pages of a Cake.me job listing and write `cake-handoff.json` to the user's Downloads folder. The file is ready for ingestion via `crawl-from-file=apps/crawler/cake-handoff.json force`.

No manual browser interaction is required from the user.

## When to Use

- User asks to capture or refresh Cake.me job listings
- Normal `crawl=fresh` is blocked (rate limiting, 503, Cloudflare)
- User says "幫我抓 Cake.me 職缺列表" or similar

## Inputs

- **URL** (optional): the Cake.me jobs URL with filters already applied.
  If not provided, use the default filter URL below.

### Default filter URL

```
https://www.cake.me/jobs?locations=%E5%8F%B0%E5%8C%97%E5%B8%82-%E5%8F%B0%E7%81%A3%2C%E6%96%B0%E5%8C%97%E5%B8%82-%E5%8F%B0%E7%81%A3&professions=it_software-engineer%2Cit_back-end-engineer%2Cit_full-stack-development%2Cit_front-end-engineer%2Cit_node-js-developer%2Cit_web-developer&job_types=full_time&seniority_levels=mid_senior_level&order=latest&page=1
```

## Method

### Step 1 — Load browser tools

Load these tools in one ToolSearch call before any other browser action:

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages
```

### Step 2 — Open a new tab

Call `tabs_context_mcp` with `createIfEmpty: true`, then `tabs_create_mcp` to get a fresh tab ID. Never reuse a tab from the user's existing session.

### Step 3 — Navigate to the jobs page

Navigate the new tab to the filter URL (with `&page=1`). Wait for the title to change from "New Tab".

### Step 4 — Verify __NEXT_DATA__ is accessible

Run this probe:

```javascript
const js = window.__NEXT_DATA__?.props?.pageProps?.initialState?.jobSearch;
if (!js) return '❌ jobSearch not found';
const key = js.activeFilterKey;
const view = js.viewsByFilterKey?.[key];
if (!view) return '❌ view not found';
const { current_page, total_pages } = view.pagination;
const pathIds = view.pageMap?.[String(current_page)] ?? [];
const data = pathIds.map(id => js.entityByPathId?.[id]).filter(Boolean);
return `✅ Page ${current_page}/${total_pages}, ${data.length} jobs`;
```

If it returns ❌, wait 3 seconds and retry once. If it still fails, stop and report to the user.

### Step 5 — Fetch all pages in batches

The javascript_tool has a ~45-second timeout. Process 4–5 pages per call.

Use this batch function (paste the full body each call, adjusting `startPage` / `endPage`):

```javascript
const DATA_KEY = 'cake_handoff_pages';
const baseUrl = new URL(window.location.href);
const pages = JSON.parse(localStorage.getItem(DATA_KEY) || '[]');
const done = new Set(pages.map(p => p.pageIndex));
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (let p = START; p <= END; p++) {
  if (done.has(p)) continue;
  baseUrl.searchParams.set('page', String(p));
  const res = await fetch(baseUrl.toString(), { credentials: 'include' });
  if (!res.ok) { console.error(`❌ Page ${p} HTTP ${res.status}`); continue; }
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) { console.error(`❌ Page ${p} 找不到 __NEXT_DATA__`); continue; }
  const nd = JSON.parse(match[1]);
  const js = nd?.props?.pageProps?.initialState?.jobSearch;
  const key = js?.activeFilterKey;
  const view = js?.viewsByFilterKey?.[key];
  if (!view) { console.error(`❌ Page ${p} 找不到 view`); continue; }
  const { current_page, total_pages, per_page, total_entries } = view.pagination;
  const pathIds = view.pageMap?.[String(current_page)] ?? [];
  const data = pathIds.map(id => js.entityByPathId?.[id]).filter(Boolean);
  const sourceUrl = (() => { const u = new URL(baseUrl); u.searchParams.set('page', String(current_page)); return u.toString(); })();
  pages.push({ sourceUrl, pageIndex: current_page, totalPages: total_pages, captureMode: 'full',
    rawResponse: { current_page, total_pages, per_page, total_entries, data } });
  localStorage.setItem(DATA_KEY, JSON.stringify(pages));
  console.log(`✅ Page ${p}/${total_pages}, ${data.length} jobs`);
  if (p < END) await sleep(800 + Math.random() * 700);
}
const total = pages.reduce((s, p) => s + p.rawResponse.data.length, 0);
return `${pages.length} pages stored, ${total} jobs`;
```

After each call, check the returned page count and calculate the next `START`/`END`. Continue until all `total_pages` are covered.

**Batch sizing rule**: aim for 4–5 pages per batch. If a batch returns fewer pages than expected (tool timeout), reduce batch size to 3 for subsequent calls.

**503 / missing data**: if a page returns HTTP 503 or no `__NEXT_DATA__`, the loop logs an error and skips. After all batches, check for missing page numbers with the STATUS snippet below and re-run a targeted batch.

### Step 6 — Check status and fill gaps

```javascript
const pages = JSON.parse(localStorage.getItem('cake_handoff_pages') || '[]');
const captured = new Set(pages.map(p => p.pageIndex));
const total = pages[0]?.totalPages ?? 0;
const missing = Array.from({length: total}, (_, i) => i + 1).filter(n => !captured.has(n));
return missing.length === 0
  ? `✅ All ${total} pages captured`
  : `❌ Missing: ${missing.join(', ')}`;
```

Re-run Step 5 for any missing pages.

### Step 7 — Download the file

```javascript
const pages = JSON.parse(localStorage.getItem('cake_handoff_pages') || '[]');
const sorted = pages.sort((a, b) => a.pageIndex - b.pageIndex);
const blob = new Blob([JSON.stringify({ host: 'cake.me', pages: sorted }, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'cake-handoff.json';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
return `Downloaded: ${sorted.length} pages, ${sorted.reduce((s,p)=>s+p.rawResponse.data.length,0)} jobs`;
```

### Step 8 — Report to user

Tell the user:
- How many pages and jobs were captured
- Where the file was saved (Downloads folder)
- The command to run next:

```
crawl-from-file=apps/crawler/cake-handoff.json force
```

## Error Handling

| Symptom | Action |
|---|---|
| `__NEXT_DATA__` not found on probe | Wait 3s, reload, retry once |
| HTTP 503 on a page | Log and skip; fill the gap in Step 6 |
| Tool timeout mid-batch | Check how many pages were saved; reduce batch size |
| Download returns fewer pages than expected | Re-check STATUS; re-run batch for missing pages |
| `crawl-from-file` reports 0 processed | Confirm the `force` flag is present in the command |

## Output

Report to user (in Traditional Chinese):

```
✅ 已擷取 [N] 頁，共 [M] 筆職缺
cake-handoff.json 已下載到下載資料夾

執行以下指令開始塞入：
crawl-from-file=apps/crawler/cake-handoff.json force
```
