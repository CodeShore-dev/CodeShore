---
name: cake-capture
description: Capture all Cake.me job listing pages via browser automation and produce a cake-handoff.json ready for crawl-from-file ingestion.
allowed-tools: Read, Glob, Bash, PowerShell, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__read_console_messages
argument-hint: [cake-jobs-url ...]
---

# cake-capture

## Overview

Uses Claude-in-Chrome browser automation to fetch all pages of one or more Cake.me job
listings. Writes one `cake-handoff.json` to the user's Downloads folder. The file is
ready for ingestion via `crawl-from-file=apps/crawler/cake-handoff.json force`.

No manual browser interaction is required from the user.

## When to Use

- User asks to capture or refresh Cake.me job listings
- Normal `crawl=fresh` is blocked (rate limiting, 503, Cloudflare)
- User says "幫我抓 Cake.me 職缺列表" or similar

## Inputs

- **URLs** (optional): one or more Cake.me jobs URLs with filters already applied.
  If the user gives no URL, capture both default URLs below.

### Default filter URLs

Capture both. Each URL is a separate list. Each list has its own page count.

1. 台北市 (Taipei City):

```
https://www.cake.me/jobs/for-it/in-%E5%8F%B0%E5%8C%97%E5%B8%82-%E5%8F%B0%E7%81%A3?seniority_levels=mid_senior_level&order=latest
```

2. 新北市 (New Taipei City):

```
https://www.cake.me/jobs/for-it/in-%E6%96%B0%E5%8C%97%E5%B8%82-%E5%8F%B0%E7%81%A3?seniority_levels=mid_senior_level&order=latest
```

The two lists overlap in page numbers. This is correct. The handoff file identifies each
page by the pair `(sourceUrl, pageIndex)`, and `sourceUrl` keeps the full URL with its
`page` parameter. Therefore page 1 of Taipei and page 1 of New Taipei do not collide.

## Method

### Step 1 — Load browser tools

Load these tools in one ToolSearch call before any other browser action:

```
select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages
```

### Step 2 — Open a new tab

Call `tabs_context_mcp` with `createIfEmpty: true`. Then call `tabs_create_mcp` to get a
fresh tab ID. Never reuse a tab from the user's existing session.

### Step 3 — Navigate to the first URL

Navigate the new tab to the first target URL. Wait for the title to change from "New Tab".

One tab is sufficient for all target URLs. All target URLs are on the same origin
(`www.cake.me`). Step 5 fetches the other URLs from this same tab. Do not navigate again
between URLs.

### Step 4 — Verify `__NEXT_DATA__` is accessible

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

If it returns ❌, wait 3 seconds. Then retry once. If it still fails, stop. Report the
failure to the user.

### Step 5 — Fetch all pages of each URL in batches

Process one target URL at a time. Finish all pages of URL 1 before you start URL 2.

The javascript_tool has a ~45-second timeout. Process 4–5 pages per call.

Use this batch function. Paste the full body each call. Set `TARGET` to the target URL.
Set `START` and `END` to the page range for this call.

```javascript
const DATA_KEY = 'cake_handoff_pages';
const TARGET = 'PASTE_TARGET_URL_HERE';
const START = 1;
const END = 5;

const pageUrl = (base, p) => { const u = new URL(base); u.searchParams.set('page', String(p)); return u.toString(); };
const pages = JSON.parse(localStorage.getItem(DATA_KEY) || '[]');
const done = new Set(pages.map(p => p.sourceUrl));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastTotal = 0;

for (let p = START; p <= END; p++) {
  const sourceUrl = pageUrl(TARGET, p);
  if (done.has(sourceUrl)) continue;
  const res = await fetch(sourceUrl, { credentials: 'include' });
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
  lastTotal = total_pages;
  const pathIds = view.pageMap?.[String(current_page)] ?? [];
  const data = pathIds.map(id => js.entityByPathId?.[id]).filter(Boolean);
  pages.push({ sourceUrl: pageUrl(TARGET, current_page), pageIndex: current_page,
    totalPages: total_pages, captureMode: 'full',
    rawResponse: { current_page, total_pages, per_page, total_entries, data } });
  localStorage.setItem(DATA_KEY, JSON.stringify(pages));
  console.log(`✅ Page ${p}/${total_pages}, ${data.length} jobs`);
  if (p < END) await sleep(800 + Math.random() * 700);
}
const mine = pages.filter(p => p.sourceUrl.startsWith(new URL(TARGET).origin + new URL(TARGET).pathname));
const total = mine.reduce((s, p) => s + p.rawResponse.data.length, 0);
return `TARGET has ${mine.length}/${lastTotal || mine[0]?.totalPages || '?'} pages stored, ${total} jobs`;
```

The first call for each target URL reports that URL's `total_pages`. Use that number to
plan the remaining batches. After each call, check the returned page count. Then
calculate the next `START` and `END`. Continue until all `total_pages` of this target URL
are covered. Then move to the next target URL.

**Batch sizing rule**: aim for 4–5 pages per batch. If a batch returns fewer pages than
expected (tool timeout), reduce batch size to 3 for later calls.

**503 or missing data**: if a page returns HTTP 503 or has no `__NEXT_DATA__`, the loop
logs an error. The loop then skips that page. After all batches, find the missing page
numbers with the STATUS snippet below. Then re-run a targeted batch.

**Do not clear `cake_handoff_pages` between target URLs.** The key holds the pages of all
target URLs together. Step 7 writes them as one file.

### Step 6 — Check status and fill gaps

This snippet groups the stored pages by target URL. It reports the missing pages of each
group.

```javascript
const pages = JSON.parse(localStorage.getItem('cake_handoff_pages') || '[]');
const groups = new Map();
for (const p of pages) {
  const u = new URL(p.sourceUrl);
  u.searchParams.delete('page');
  const base = u.toString();
  if (!groups.has(base)) groups.set(base, { total: p.totalPages, seen: new Set() });
  groups.get(base).seen.add(p.pageIndex);
}
const lines = [];
for (const [base, g] of groups) {
  const missing = Array.from({ length: g.total }, (_, i) => i + 1).filter(n => !g.seen.has(n));
  lines.push(missing.length === 0
    ? `✅ ${base} — all ${g.total} pages`
    : `❌ ${base} — missing: ${missing.join(', ')}`);
}
return lines.join('\n') || 'no pages stored';
```

Re-run Step 5 for any missing page. Set `TARGET` to that group's URL.

Also confirm that the number of groups equals the number of target URLs. A missing group
means Step 5 never ran for that URL.

### Step 7 — Download the file

This writes all target URLs into one file.

```javascript
const pages = JSON.parse(localStorage.getItem('cake_handoff_pages') || '[]');
const baseOf = u => { const x = new URL(u); x.searchParams.delete('page'); return x.toString(); };
const sorted = [...pages].sort((a, b) => {
  const ka = baseOf(a.sourceUrl);
  const kb = baseOf(b.sourceUrl);
  return ka === kb ? a.pageIndex - b.pageIndex : (ka < kb ? -1 : 1);
});
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

### Step 8 — Clear the browser storage

Run this after a successful download. It prevents a later run from re-using stale pages.

```javascript
localStorage.removeItem('cake_handoff_pages');
return 'cleared';
```

### Step 9 — Report to user

Tell the user:
- How many target URLs, pages and jobs were captured
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
| STATUS shows fewer groups than target URLs | Run Step 5 for the target URL that has no group |
| Old pages from a previous run appear | Run Step 8, then start again from Step 3 |
| `crawl-from-file` reports 0 processed | Confirm the `force` flag is present in the command |

## Output

Report to user (in Traditional Chinese):

```
✅ 已擷取 [K] 個列表網址、[N] 頁，共 [M] 筆職缺
  - 台北市：[N1] 頁
  - 新北市：[N2] 頁
cake-handoff.json 已下載到下載資料夾

執行以下指令開始塞入：
crawl-from-file=apps/crawler/cake-handoff.json force
```
