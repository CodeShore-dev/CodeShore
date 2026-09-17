// ==UserScript==
// @name         Cake.me Job Capture
// @namespace    codeshore
// @version      1.0
// @description  自動逐頁擷取 Cake.me 職缺列表並存入 localStorage
// @match        https://www.cake.me/jobs*
// @grant        none
// ==/UserScript==

(async () => {
  const DATA_KEY  = 'cake_handoff_pages';
  const MODE_KEY  = 'cake_capture_active';

  if (!localStorage.getItem(MODE_KEY)) return;

  // 等 Next.js hydration 完成
  await new Promise(r => setTimeout(r, 3000));

  const js = window.__NEXT_DATA__?.props?.pageProps?.initialState?.jobSearch;
  if (!js) {
    // 頁面沒正常載入（可能是 503 / Cloudflare block）— 等 30 秒後重試同一頁
    console.warn('[Cake] ⚠️ 頁面異常，30 秒後重試...');
    await new Promise(r => setTimeout(r, 30000));
    window.location.reload();
    return;
  }

  const key  = js.activeFilterKey;
  const view = js.viewsByFilterKey?.[key];
  if (!view) { console.error('[Cake] ❌ 找不到 view'); return; }

  const { current_page, total_pages, per_page, total_entries } = view.pagination;
  const pathIds = view.pageMap?.[String(current_page)] ?? [];
  const data    = pathIds.map(id => js.entityByPathId?.[id]).filter(Boolean);

  if (data.length === 0) {
    console.error('[Cake] ❌ 找不到職缺，pathIds:', pathIds);
    return;
  }

  const sourceUrl = (() => {
    const u = new URL(window.location.href);
    u.searchParams.set('page', String(current_page));
    return u.toString();
  })();

  const pages = JSON.parse(localStorage.getItem(DATA_KEY) || '[]');

  if (!pages.some(p => p.pageIndex === current_page)) {
    pages.push({
      sourceUrl,
      pageIndex: current_page,
      totalPages: total_pages,
      captureMode: 'full',
      rawResponse: { current_page, total_pages, per_page, total_entries, data },
    });
    localStorage.setItem(DATA_KEY, JSON.stringify(pages));
  }

  console.log(`[Cake] ✅ Page ${current_page}/${total_pages}，${data.length} 筆，共累積 ${pages.length} 頁`);

  // 全部完成
  if (current_page >= total_pages) {
    localStorage.removeItem(MODE_KEY);
    console.log('[Cake] 🎉 全部完成！在 console 貼 EXPORT 段落匯出。');
    return;
  }

  // 前往下一頁（隨機延遲 8~20 秒，降低 Cloudflare 觸發機率）
  const delay = 8000 + Math.random() * 12000;
  console.log(`[Cake] ➡️ ${delay.toFixed(0)}ms 後前往 Page ${current_page + 1}...`);
  await new Promise(r => setTimeout(r, delay));

  const next = new URL(window.location.href);
  next.searchParams.set('page', String(current_page + 1));
  window.location.href = next.toString();
})();

// ─────────────────────────────────────────────────────────────
// 使用方式
// ─────────────────────────────────────────────────────────────
//
// 1. 瀏覽器套好篩選條件，停在第 1 頁
// 2. 在 console 貼下方 START 啟動（只需一次）：
//
//    localStorage.removeItem('cake_handoff_pages');
//    localStorage.setItem('cake_capture_active', '1');
//    const u = new URL(location.href); u.searchParams.set('page','1'); location.href = u;
//
// 3. 等待自動跑完（約 total_pages × 4 秒）
//
// 4. 完成後在 console 貼 EXPORT：
//
//    copy(JSON.stringify({ host: 'cake.me', pages: JSON.parse(localStorage.getItem('cake_handoff_pages') || '[]') }, null, 2));
//
// 5. 存成 cake.json，執行：crawl-from-file=apps/crawler/cake.json
