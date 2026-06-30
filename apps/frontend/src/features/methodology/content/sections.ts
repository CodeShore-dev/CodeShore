import type { MethodologySection } from '../content/types';

/**
 * Methodology 頁四大主題段落的唯一可信來源（zh-TW）。
 * 內容對齊本專案實際的爬蟲、資料庫 schema、技術棧與部署設定，
 * 僅職缺描述方法與架構，不含任何金鑰、憑證或連線字串。
 */
// 註：「資料來源與爬蟲」段落已改以關係圖呈現（見 CrawlerPipelineSection 與
// content/crawlerPipeline.ts）；「資料庫架構」段落已改以關係圖呈現（見 DatabaseSchemaSection
// 與 content/databaseSchema.ts），兩者均不再於此文字段落清單中重複定義。
export const methodologySections: readonly MethodologySection[] = [
  {
    id: 'web-tech',
    title: '網站技術',
    blocks: [
      {
        kind: 'paragraph',
        text: '本專案以 Nx 管理的 monorepo 組織，前端（Vue）、後端（NestJS）與爬蟲共用一套程式碼與共享套件，依賴集中於根目錄管理，並以 Node 22 為執行環境。共享套件以套件別名引用，讓前後端共用型別與資料存取邏輯、減少重複。',
      },
      {
        kind: 'paragraph',
        text: '主要技術組成：',
      },
      {
        kind: 'table',
        headers: ['層', '技術', '角色'],
        rows: [
          [
            '前端',
            'Vue 3.5（Composition API + script setup）、Vue Router 4、Pinia 3、Tailwind CSS 4、Vite 7',
            '使用者介面、路由、狀態管理、樣式與打包。',
          ],
          ['後端', 'NestJS 11（Express）', '提供分析資料 API、彙總查詢入口與快取。'],
          ['資料庫', 'Supabase（PostgreSQL）', '主資料庫，承載原始資料表、物化視圖與 function。'],
          ['爬蟲', 'Crawlee + Puppeteer（stealth）', '定期抓取公開職缺並正規化寫回資料庫。'],
          [
            '共享套件',
            '@codeshore/data-types、@codeshore/data-utils、@codeshore/shared-utils、@codeshore/supabase',
            '前後端共用型別、Supabase 資料存取層、通用工具與 client。',
          ],
        ],
      },
      {
        kind: 'paragraph',
        text: '技術選型的取捨理由：採 monorepo 是為了讓前後端與爬蟲共用同一份資料型別與存取邏輯，避免「同一張表在三處各自定義」造成的不一致；以 Supabase（PostgreSQL）為主資料庫，使我們能直接運用物化視圖與 SQL function 做伺服器端預先彙總，把昂貴計算留在資料庫一側；前端選用 Vue + Vite + Tailwind，著重開發速度與小體積產出；後端以 NestJS 提供結構化的模組與攔截器機制，便於統一掛載快取與監測。',
      },
      {
        kind: 'paragraph',
        text: '前後端與資料層如何協作產生使用者所見的分析結果：爬蟲把公開職缺正規化寫入 PostgreSQL 原始資料表；資料庫以物化視圖與 function 預先彙總出薪資基準、技術排行、技術組合與公司統計等結果；後端透過資料存取層查詢這些彙總結果並加上一層快取後以 API 提供；前端再以 Vue 元件呈現為使用者所見的圖表與列表。整條鏈路中，「計算」集中在資料庫與後端，前端只負責呈現。',
      },
    ],
  },
  {
    id: 'cloud-performance',
    title: '雲端與效能',
    blocks: [
      {
        kind: 'paragraph',
        text: '本站刻意在低成本、近乎免費方案的限制下運作。後端容器化後部署於 Google Cloud Run，資料庫使用 Supabase。這兩個平台在低用量級距具備關鍵限制，效能設計即圍繞如何在這些限制下仍能承接尖峰流量。',
      },
      {
        kind: 'paragraph',
        text: '關鍵限制：',
      },
      {
        kind: 'list',
        items: [
          'Cloud Run 採「縮放到零」（scale-to-zero）：無流量時不保留執行個體以節省成本，但下一次請求進來時需要冷啟動（cold start），第一個請求會較慢。',
          'Supabase 與後端在低成本方案下，連線數與運算資源有限，無法承受每個請求都對原始資料表做即時重算。',
        ],
      },
      {
        kind: 'paragraph',
        text: '在這些限制下為承接高流量所採取的手段：',
      },
      {
        kind: 'table',
        headers: ['手段', '如何降低資料庫與後端負載'],
        rows: [
          [
            '物化視圖預先彙總',
            '薪資基準、技術排行、技術組合、公司統計等昂貴計算事先算好並落地，分析頁讀取的是現成結果，避免每次請求都做全表掃描與百分位計算。',
          ],
          [
            '後端記憶體快取',
            '後端對彙總查詢以 in-memory 快取（可設定 TTL）保存結果，相同查詢在快取有效期內直接回傳，不再打到資料庫；快取命中與否會以回應標頭（X-Cache: HIT / MISS）標示，便於觀察。',
          ],
          [
            '限制查詢量',
            '熱門榜單類查詢以 LIMIT 取前 N 筆（如熱門技術組合取前 15 筆），把單次回應與運算量控制在小範圍。',
          ],
          ['索引加速', '常見的篩選與排序皆有對應索引，使必要的即時查詢仍能快速完成。'],
          ['靜態前端', '前端為打包後的靜態資產，初始呈現不依賴後端逐項計算，與資料 API 解耦。'],
        ],
      },
      {
        kind: 'paragraph',
        text: '這些手段如何讓低成本方案服務較高流量：把「重計算」前移到資料庫的物化視圖、再以後端快取吸收重複請求，使絕大多數讀取不會真正觸及原始資料表；高流量時相同的熱門查詢多由快取回應，資料庫負載被壓平，後端也不需為了瞬時尖峰而擴充昂貴資源。',
      },
      {
        kind: 'paragraph',
        text: '使用者可觀察的效能感受：在後端執行個體已就緒（已「暖機」）時，分析頁的資料通常能快速回應；若是長時間無人造訪後的第一個請求，可能會因冷啟動而稍慢，之後的請求即恢復順暢。當熱門查詢的快取生效時，重複瀏覽相同分析會明顯更即時。',
      },
    ],
  },
] as const;
