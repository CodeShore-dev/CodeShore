import type { MethodologySection } from '../content/types';

/**
 * Methodology 頁四大主題段落的唯一可信來源（zh-TW）。
 * 內容對齊本專案實際的爬蟲、資料庫 schema、技術棧與部署設定，
 * 僅描述方法與架構，不含任何金鑰、憑證或連線字串。
 */
export const methodologySections: readonly MethodologySection[] =
  [
    {
      id: 'data-crawler',
      title: '資料來源與爬蟲',
      blocks: [
        {
          kind: 'paragraph',
          text: 'CodeShore 是工程師求職「市場分析站」，不是職缺平台。我們爬取公開招募頁面、做完分析後再把使用者導回原平台投履歷，本站不收履歷、不做媒合。所有分析數字皆建立在公開職缺資料之上。',
        },
        {
          kind: 'paragraph',
          text: '資料來源為兩個公開職缺平台：104 人力銀行（約佔 54%）與 Cake（約佔 28%）。爬蟲以 Crawlee 的 PuppeteerCrawler 驅動無頭 Chrome 抓取，並針對不同來源（104 / Cake）以各自的列表 API 解析與詳情頁擷取器處理，最後正規化為一致的職缺資料結構寫回資料庫。',
        },
        {
          kind: 'paragraph',
          text: '爬蟲提供數種執行模式，依用途切換，避免每次都全量重抓而浪費資源：',
        },
        {
          kind: 'table',
          headers: ['執行模式', '用途'],
          rows: [
            [
              '全量（fresh）',
              '從第 1 頁起重新建立待抓清單，掃過來源平台所有列表頁，適用於初次建置或大規模重建。',
            ],
            [
              '續抓（resume）',
              '預設模式。沿用資料庫中尚未完成（pending）的列表頁清單接續抓取，中斷後可從斷點恢復，不必從頭重來。',
            ],
            [
              '更新（re-crawl）',
              '重新拜訪既有職缺的詳情頁，比對描述、薪資、地點是否變動並就地更新；若頁面已不存在則標記為已關閉（closed）。',
            ],
            [
              '條件更新（re-crawl=條件）',
              '更新模式可帶查詢條件（如指定單筆 id 或某段更新時間區間），只重抓符合條件的職缺，縮小範圍。',
            ],
            [
              '薪資重算（job-salary）',
              '不重新連線抓取，直接對既有職缺的薪資字串重新解析出 min / max 與薪資型態（手動標記過的薪資則略過）。',
            ],
            [
              '關鍵字重算（job-keyword）',
              '不重新連線抓取，針對既有職缺描述以最新的關鍵字群組字典重新萃取技術關鍵字。',
            ],
          ],
        },
        {
          kind: 'paragraph',
          text: '更新與續抓策略：列表頁的處理進度以 status 記錄於資料庫（pending / completed / failed），續抓模式只接手 pending 的頁面，因此中斷可恢復、不會重複處理已完成的頁面。抓取列表時會先載入既有職缺的 id 清單做比對：只有「新職缺」才會排入詳情頁抓取佇列，既有職缺則交由更新模式處理，藉此避免重複抓取。詳情頁資料採批次累積後一次性 upsert（批次大小依來源每頁筆數調整），降低資料庫寫入次數。更新模式預設只挑選「昨日之前未更新」的職缺重抓，使資料持續滾動更新而非一次處理全部。',
        },
        {
          kind: 'paragraph',
          text: '反爬與穩定性做法（層級概述）：以 puppeteer-extra 的 stealth 外掛搭配 rebrowser-puppeteer，並設定貼近真實瀏覽器的視窗大小、語系與請求標頭，降低被自動化偵測攔截的機率；抓取以低併發（單一併發）方式進行以減輕對來源的壓力；對列表 API 回應採逾時控制與多次重試（含重新載入頁面），單一頁面失敗不會中斷整體流程，並將該頁標記為 failed 以利後續處理。',
        },
        {
          kind: 'paragraph',
          text: '揭露範圍說明：本段僅描述「方法與架構」層級，不包含任何金鑰、憑證、連線字串或可直接重現受保護操作的機密設定。',
        },
      ],
    },
    {
      id: 'database',
      title: '資料庫架構',
      blocks: [
        {
          kind: 'paragraph',
          text: '資料庫採用 Supabase（PostgreSQL）。整體分為三層：原始資料表（table）保存爬蟲寫入的事實資料；物化視圖（materialized view）將昂貴的彙總與統計預先算好；function 提供統計查詢與視圖重新整理的入口；index 則針對常見的篩選與排序加速。分析頁讀取的多半是預先彙總好的結果，而非每次即時掃描原始資料表。',
        },
        {
          kind: 'paragraph',
          text: '核心資料表（table）與其在分析流程中的角色：',
        },
        {
          kind: 'table',
          headers: ['資料表', '角色與目的'],
          rows: [
            [
              'job',
              '職缺主表：標題、地點、薪資（原字串與解析出的 min / max、薪資型態）、描述、所屬公司、是否關閉等，是所有分析的事實來源。',
            ],
            [
              'company',
              '公司主表：名稱、連結、類型，供公司列表與職缺關聯。',
            ],
            [
              'job_keyword',
              '每筆職缺萃取出的關鍵字陣列與中英文比例，供技術熱度分析使用。',
            ],
            [
              'keyword / keyword_group / keyword_group_keyword / keyword_group_parent',
              '關鍵字字典與群組映射：把零散關鍵字歸併為可分析的技術群組，並維護群組之間的階層關係（供技術組合分析）。',
            ],
            [
              'job_keyword_group',
              '職缺與技術群組的對應表，是技術排行與技術組合統計的連結基礎。',
            ],
            [
              'location_group / location_group_location',
              '地點正規化：把雜亂的地點字串歸併到地點群組。',
            ],
            [
              'job_preference',
              '登入使用者對職缺的喜歡 / 不喜歡標記。',
            ],
            [
              'job_source / job_source_url',
              '爬蟲來源 URL 與各列表頁的抓取進度（供續抓 / 斷點恢復）。',
            ],
          ],
        },
        {
          kind: 'paragraph',
          text: '物化視圖（materialized view）：將分析所需的彙總結果預先計算並落地，讓分析頁以接近單次查詢的成本取得結果。各視圖用途如下：',
        },
        {
          kind: 'table',
          headers: [
            '物化視圖',
            '為哪些分析提供預先彙總結果',
          ],
          rows: [
            [
              'mv_job',
              '對外呈現的職缺視圖：併入公司資訊、正規化地點、技術群組陣列，並對「面議 / 以上」薪資以市場加權比率補上推估平均薪資，供職缺列表與篩選。',
            ],
            [
              'mv_company',
              '公司彙總：每間公司的有效職缺數與技術群組分布，供公司列表。',
            ],
            [
              'mv_salary_type_median_ratio',
              '依薪資型態（月薪 / 年薪）預先算好的薪資基準：PR50（中位）、PR75、PR88，供首頁薪資基準分析。',
            ],
            [
              'mv_salary_weighted_ratio',
              '各薪資型態的市場加權平均比率（最高薪 / 最低薪），用來推估「面議 / 以上」職缺的代表薪資。',
            ],
            [
              'mv_tech_combo_stats',
              '技術「兩兩組合」的職缺數與月 / 年薪各百分位統計，供熱門技術組合分析。',
            ],
            [
              'mv_keyword_group',
              '關鍵字群組彙總：每個群組的總出現次數、所屬關鍵字、階層關係與標籤 / 圖示，供技術熱度排行。',
            ],
            [
              'mv_keyword_group_ranking',
              '各技術群組的職缺數與月 / 年薪各百分位（PR50 / PR75 / PR88）統計，供技術排行頁。',
            ],
            [
              'mv_keyword_group_category',
              '技術群組的分類計數，供分類維度的彙總。',
            ],
            [
              'mv_keyword_group_tags',
              '技術群組標籤的計數，供標籤維度的彙總。',
            ],
            [
              'mv_location_group',
              '各地點群組的職缺數，供地點維度的彙總。',
            ],
          ],
        },
        {
          kind: 'paragraph',
          text: '關鍵 function 與其用途：',
        },
        {
          kind: 'table',
          headers: ['Function', '用途'],
          rows: [
            [
              'get_job_count',
              '回傳職缺總數、開放中職缺數，以及月薪 / 年薪可分析職缺數，供首頁統計列。',
            ],
            [
              'get_weighted_market_ratio',
              '以「比例 × 該比例人數 ÷ 總人數」的加權公式，算出全站薪資的市場加權比率與有效樣本數。',
            ],
            [
              'get_tech_combo_stats',
              '從 mv_tech_combo_stats 取出職缺數最多的前 N 組技術組合，供熱門技術組合榜。',
            ],
            [
              'get_jobs_by_preference / get_unreviewed_jobs',
              '依使用者標記取出已標記 / 尚未檢視的職缺（讀自 mv_job）。',
            ],
            [
              'refresh_mv_*（如 refresh_mv_job、refresh_mv_company、refresh_mv_salary_type_median_ratio 等）',
              '以 CONCURRENTLY 方式重新整理對應的物化視圖，使彙總結果反映最新資料且重整期間不阻塞讀取。',
            ],
          ],
        },
        {
          kind: 'paragraph',
          text: 'Index 設計目的：針對最常見的篩選與排序建立索引以加速查詢，避免全表掃描。例如：依「是否關閉」與「公司」過濾開放職缺、依薪資與更新時間排序（min_salary / max_salary / updated_at 複合索引）、依地點與薪資字串查詢、職缺與技術群組的關聯查詢、以及使用者偏好（user_id）查詢。物化視圖上的唯一索引同時讓視圖能以 CONCURRENTLY 方式重新整理；技術群組陣列等欄位另以 GIN 索引加速包含式查詢。',
        },
        {
          kind: 'paragraph',
          text: '一致性原則：本段所述物件均對應站台實際運作中的資料庫物件，不描述不存在的物件；各分析數字的統計範圍與其背後對應的物化視圖 / function 一致。',
        },
      ],
    },
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
            [
              '後端',
              'NestJS 11（Express）',
              '提供分析資料 API、彙總查詢入口與快取。',
            ],
            [
              '資料庫',
              'Supabase（PostgreSQL）',
              '主資料庫，承載原始資料表、物化視圖與 function。',
            ],
            [
              '爬蟲',
              'Crawlee + Puppeteer（stealth）',
              '定期抓取公開職缺並正規化寫回資料庫。',
            ],
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
            [
              '索引加速',
              '常見的篩選與排序皆有對應索引，使必要的即時查詢仍能快速完成。',
            ],
            [
              '靜態前端',
              '前端為打包後的靜態資產，初始呈現不依賴後端逐項計算，與資料 API 解耦。',
            ],
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
