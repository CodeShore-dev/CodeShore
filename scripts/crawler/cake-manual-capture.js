/**
 * Cake.me 列表頁擷取工具
 *
 * 資料來源：window.__NEXT_DATA__（Cake.me 使用 Next.js SSR，職缺資料直接嵌入頁面）
 * 輸出格式：HandoffFile { host: 'cake.me', pages: HandoffPage[] }
 * 對應型別：apps/crawler/src/handoff/types.ts
 * 執行指令：crawl-from-file=apps/crawler/cake-handoff.json force
 *
 * ─────────────────────────────────────────────────────────────
 * 方法一：Claude 自動抓（推薦）
 * ─────────────────────────────────────────────────────────────
 * 直接叫 Claude：「幫我抓 Cake.me 職缺列表」
 * Claude 會用瀏覽器自動化工具（Claude-in-Chrome）開一個新分頁，
 * 用 fetch 循環抓所有頁面，完成後自動下載 cake-handoff.json。
 * 下載完成後把檔案放到 apps/crawler/，執行：
 *   crawl-from-file=apps/crawler/cake-handoff.json force
 *
 * 抓取邏輯（Claude 執行的核心片段，分批呼叫以避免逾時）：
 */

// FETCH-BATCH — Claude 用瀏覽器自動化工具在 Cake.me 分頁執行，每批約 4~5 頁
// 參數：startPage, endPage（依批次調整）
async function fetchBatch(startPage, endPage) {
  const DATA_KEY = 'cake_handoff_pages';
  const baseUrl = new URL(window.location.href);
  const pages = JSON.parse(localStorage.getItem(DATA_KEY) || '[]');
  const done = new Set(pages.map(p => p.pageIndex));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (let p = startPage; p <= endPage; p++) {
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
    const sourceUrl = (() => {
      const u = new URL(baseUrl);
      u.searchParams.set('page', String(current_page));
      return u.toString();
    })();
    pages.push({ sourceUrl, pageIndex: current_page, totalPages: total_pages, captureMode: 'full',
      rawResponse: { current_page, total_pages, per_page, total_entries, data } });
    localStorage.setItem(DATA_KEY, JSON.stringify(pages));
    console.log(`✅ Page ${p}/${total_pages}，${data.length} 筆`);
    if (p < endPage) await sleep(800 + Math.random() * 700);
  }
  return `現有 ${pages.length} 頁`;
}

// FETCH-DOWNLOAD — 全部批次跑完後觸發下載
function downloadHandoff() {
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
  return `下載完成：${sorted.length} 頁，${sorted.reduce((s, p) => s + p.rawResponse.data.length, 0)} 筆職缺`;
}


// ─────────────────────────────────────────────────────────────
// 方法二：手動逐頁（備用，Claude-in-Chrome 不可用時）
// ─────────────────────────────────────────────────────────────
//
// 1. 瀏覽器套好篩選條件，確認在 page 1
// 2. 開 DevTools console，貼 CAPTURE 段落
// 3. 在 address bar 把 page=2 打進去按 Enter（full reload）
// 4. 重複到全部頁面（看到 🎉）
// 5. 貼 DOWNLOAD 段落下載 cake-handoff.json
// ─────────────────────────────────────────────────────────────

// CAPTURE — 每頁 full reload 完成後貼入 console 執行一次
(async () => {
  const KEY = 'cake_handoff_pages';
  const js = window.__NEXT_DATA__?.props?.pageProps?.initialState?.jobSearch;
  if (!js) { console.error('❌ 找不到 jobSearch'); return; }
  const key = js.activeFilterKey;
  const view = js.viewsByFilterKey?.[key];
  if (!view) { console.error('❌ 找不到 view'); return; }
  const { current_page, total_pages, per_page, total_entries } = view.pagination;
  const pathIds = view.pageMap?.[String(current_page)] ?? [];
  const data = pathIds.map(id => js.entityByPathId?.[id]).filter(Boolean);
  if (data.length === 0) { console.error('❌ 找不到職缺，pathIds:', pathIds); return; }
  const sourceUrl = (() => {
    const u = new URL(window.location.href);
    u.searchParams.set('page', String(current_page));
    return u.toString();
  })();
  const pages = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (pages.some(p => p.pageIndex === current_page)) {
    console.warn(`⚠️ Page ${current_page} 已存在`); return;
  }
  pages.push({ sourceUrl, pageIndex: current_page, totalPages: total_pages, captureMode: 'full',
    rawResponse: { current_page, total_pages, per_page, total_entries, data } });
  localStorage.setItem(KEY, JSON.stringify(pages));
  console.log(`✅ Page ${current_page}/${total_pages}，本頁 ${data.length} 筆。已累積 ${pages.length} 頁`);
  if (pages.length === total_pages) console.log('🎉 全部完成！');
})();


// DOWNLOAD — 全部頁面完成後執行，下載 cake-handoff.json
(() => {
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
  console.log(`📥 已下載 cake-handoff.json（${sorted.length} 頁）`);
})();


// STATUS — 查看目前已累積幾頁
(() => {
  const pages = JSON.parse(localStorage.getItem('cake_handoff_pages') || '[]');
  if (pages.length === 0) { console.log('尚無資料'); return; }
  const total = pages[0]?.totalPages ?? '?';
  const nums = pages.map(p => p.pageIndex).sort((a, b) => a - b).join(', ');
  console.log(`已累積 ${pages.length}/${total} 頁，頁碼：${nums}`);
})();


// RESET — 清除 localStorage 重新開始
localStorage.removeItem('cake_handoff_pages');
console.log('🗑️ 已清除');
