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
        text: '本專案以 Nx 管理的 monorepo 組織，前端（React）、後端（NestJS）與爬蟲共用一套程式碼與共享套件，依賴集中於根目錄管理，並以 Node 22 為執行環境。共享套件以套件別名引用（如 @codeshore/data-types、@codeshore/data-utils），讓前後端共用型別與資料存取邏輯、減少重複定義。',
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
            'React 19（function components + hooks）、react-router 7（library mode）、TanStack Query 5、Zustand 5、Tailwind CSS 4、Vite 7',
            '使用者介面、路由、server-state 快取、UI/filter 狀態管理、樣式與打包。',
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
        text: '技術選型的取捨理由：採 monorepo 是為了讓前後端與爬蟲共用同一份資料型別與存取邏輯，避免「同一張表在三處各自定義」造成的不一致；以 Supabase（PostgreSQL）為主資料庫，使我們能直接運用物化視圖與 SQL function 做伺服器端預先彙總，把昂貴計算留在資料庫一側；前端選用 React + TanStack Query + Zustand，將「伺服器資料快取」與「純 UI 狀態」明確分離，避免單一狀態容器混雜兩種截然不同生命週期的資料；搭配 Vite 與 Tailwind CSS 著重開發速度與小體積產出；後端以 NestJS 提供結構化的模組與攔截器機制，便於統一掛載快取與監測。',
      },
      {
        kind: 'paragraph',
        text: '前後端與資料層如何協作產生使用者所見的分析結果：爬蟲把公開職缺正規化寫入 PostgreSQL 原始資料表；資料庫以物化視圖與 function 預先彙總出薪資基準、技術排行、技術組合與公司統計等結果；後端透過資料存取層查詢這些彙總結果並加上一層快取後以 API 提供；前端再以 TanStack Query 取得資料並以 React 元件呈現為使用者所見的圖表與列表，其餘篩選條件等 UI 狀態則交由 Zustand 管理。整條鏈路中，「計算」集中在資料庫與後端，前端只負責呈現與互動狀態。',
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
      {
        kind: 'paragraph',
        text: '索引盤點：資料庫的索引並非「越多越好」——每多一個索引，寫入（INSERT／UPDATE／REFRESH MATERIALIZED VIEW）就多一份要維護的成本。建立原則是只對實際出現在查詢的 WHERE、JOIN 或 ORDER BY 裡的欄位建索引；若某個單欄索引的欄位剛好是另一個複合索引（或主鍵）的最左欄位，兩者用途高度重疊，會依 pg_stat_user_indexes 的正式環境實際掃描次數判斷去留，而非只靠理論推斷。近一次盤點依此方法移除了 5 個掃描次數極低、與既有複合索引／主鍵重疊的單欄索引（tech_keyword.tech、location_group_location.location_group、tech_parent.parent、job_preference.user_id、job.salary 的原始文字索引），同時也保留了兩個「理論上像是重複、但正式環境掃描次數其實很高」的索引（job_tech.job_id、job.closed），下表是目前所有索引與各自的建立原因。',
      },
      {
        kind: 'table',
        headers: ['資料表', '索引', '為何建立'],
        rows: [
          ['job', 'ix_job_closed (closed)', '多數彙總查詢只單純篩選「在架職缺」（closed = false），不會同時帶公司條件，這個欄位獨立建索引可對應這類最常見的過濾（正式環境掃描次數高於下一個複合索引）。'],
          ['job', 'ix_job_closed_company_id (closed, company_id)', '依公司彙總在架職缺（如 mv_company／mv_job 建置查詢：JOIN job ON company_id = ... WHERE closed = false）需要同時篩兩欄位，複合索引才夠快。'],
          ['job', 'ix_job_company_id (company_id)', '職缺外鍵指回 company，供「這間公司有哪些職缺」的純公司維度查詢與 JOIN 使用；此欄位不在前一個複合索引的最左位置，需要獨立索引才吃得到。'],
          ['job', 'ix_job_min_salary_max_salary_updated_at (min_salary DESC, max_salary DESC, crawled_at DESC)', '索引名稱沿用建立當時的欄位名稱；「爬取時間／異動時間」欄位拆分將 job.updated_at 改名為 crawled_at 後，此索引第三欄隨欄位改名同步指向 crawled_at（爬取時間），索引名稱本身未變。原本刻意對齊 mv_job 定義裡的 ORDER BY 以利 REFRESH MATERIALIZED VIEW CONCURRENTLY 重建彙總結果時省去額外排序，但 mv_job 現在的 ORDER BY 改用拆分後新增的 updated_at（異動時間）欄位，兩者已非同一欄位。'],
          ['job', 'job_location_idx (location)', '原始職缺地點字串要 JOIN location_group_location 找出所屬地區群組，此索引加速這個 join。'],
          ['job_preference', 'ix_job_preference_user_id_job_id (user_id, job_id)', '「我的收藏／不感興趣」等使用者維度查詢固定以 user_id 開頭，複合索引同時支援「這個使用者的所有偏好」與「這個使用者對這筆職缺的偏好」兩種查法。'],
          ['job_tech', 'ix_job_tech_job_id (job_id)', '由「這筆職缺」找出它掛的所有技術標籤，是產生 mv_job／mv_company 技術陣列時最熱的查詢路徑（正式環境掃描次數逾 188 萬次，是全庫掃描次數最高的索引之一）。'],
          ['job_tech', 'ix_job_tech_tech (tech)', '反向查詢「用到這個技術的所有職缺」，供技術排行、技術組合統計等彙總使用。'],
          ['location_group_location', 'location_group_location_location_idx (location)', '由原始地點字串反查所屬地區群組，供 mv_job／mv_location_group 建置時 JOIN 使用。'],
          ['mv_company', 'ix_mv_company_job_count (job_count)', '依職缺數量排序公司清單。'],
          ['mv_company', 'ix_mv_company_type (company_type)', '依公司類型篩選公司清單。'],
          ['mv_company', 'ux_mv_company_company_id（唯一索引）', 'REFRESH MATERIALIZED VIEW CONCURRENTLY 的硬性需求：物化視圖沒有唯一索引就無法做「不鎖讀」的線上刷新。'],
          ['mv_job', 'ix_mv_job_company_id (company_id)', '依公司查詢職缺列表。'],
          ['mv_job', 'ix_mv_job_max_salary (max_salary DESC) ／ ix_mv_job_min_salary (min_salary DESC)', '分別支援「依最高薪資排序」與「依最低薪資排序」兩種獨立排序選項。'],
          ['mv_job', 'ix_mv_job_salary_type (salary_type)', '依月薪／年薪篩選職缺。'],
          ['mv_job', 'ix_mv_job_techs（GIN，techs）', '支援「包含特定技術」的陣列 containment 查詢，即技術篩選器背後的索引。'],
          ['mv_job', 'ix_mv_job_updated_at (updated_at DESC)', '依異動時間（updated_at，職缺內容真正改變的時間，而非爬取時間）排序，對應預設排序／「最新職缺」。'],
          ['mv_job', 'mv_job_id_idx（唯一索引，id）', 'REFRESH CONCURRENTLY 必要的唯一鍵。'],
          ['mv_job', 'mv_job_location_idx (location)', '依地區篩選職缺列表。'],
          ['mv_location_group', 'mv_location_group_idx（唯一索引，location）', 'REFRESH CONCURRENTLY 必要的唯一鍵，同時支援依地區查詢職缺數。'],
          ['mv_salary_range_multiplier', 'idx_mv_salary_range_multiplier_type（唯一索引，salary_type）', 'REFRESH CONCURRENTLY 必要的唯一鍵，同時是月薪／年薪換算比例的查詢鍵。'],
          ['mv_salary_type_median_ratio', 'idx_mv_salary_type_median_ratio_type（唯一索引，salary_type）', 'REFRESH CONCURRENTLY 必要的唯一鍵，同時供中位數／高薪／頂薪基準查詢。'],
          ['mv_tech', 'ix_mv_tech_category (category)', '依技術分類篩選。'],
          ['mv_tech', 'ix_mv_tech_count (count DESC)', '依出現次數排序技術熱門度。'],
          ['mv_tech', 'ix_mv_tech_keywords（GIN，keywords）', '支援關鍵字陣列 containment 查詢。'],
          ['mv_tech', 'ux_mv_tech_tech（唯一索引，tech）', 'REFRESH CONCURRENTLY 必要的唯一鍵，同時是技術詳情查詢鍵。'],
          ['mv_tech_category', 'ux_mv_tech_category_category（唯一索引，category）', 'REFRESH CONCURRENTLY 必要的唯一鍵。'],
          ['mv_tech_combo_stats', 'ux_mv_tech_combo_stats_tech1_tech2（唯一索引，tech1、tech2）', 'REFRESH CONCURRENTLY 必要的唯一鍵，同時是「技術組合」查詢鍵。'],
          ['mv_tech_ranking', 'ux_mv_tech_ranking_tech（唯一索引，tech）', 'REFRESH CONCURRENTLY 必要的唯一鍵。'],
          ['mv_tech_tags', 'ux_mv_tech_tags（唯一索引，tag、category）', 'REFRESH CONCURRENTLY 必要的唯一鍵。'],
          ['tech', 'tech_category_idx (category)', '依技術分類篩選，供 mv_tech 等彙總建置時使用。'],
          ['tech_keyword', 'ix_tech_keyword_keyword (keyword)', '由關鍵字反查對應技術，供關鍵字正規化流程使用。'],
          ['tech_parent', 'tech_parent_child_idx (child)', '由「子技術」找出其所有父層技術，用於技術樹狀彙總（mv_tech 的 parents 計算）。'],
        ],
      },
    ],
  },
  {
    id: 'dev-methodology',
    title: '開發方法論',
    blocks: [
      {
        kind: 'paragraph',
        text: '「網站技術」段落談的是這個網站用了什麼技術組成；這裡談的是另一件事：這個網站怎麼被開發出來。本專案實際上是由 Claude Code 進行 AI agent coding，並採用 Kiro 風格、spec-driven 的開發流程（cc-sdd）——換句話說，程式碼的產生方式本身也是這個專案工程做法的一部分，值得與技術棧分開揭露。',
      },
      {
        kind: 'paragraph',
        text: '這套 spec-driven agent coding 工作流程為開發帶來的整體效益，可以濃縮為一個重點：把「需求 → 設計 → 任務拆解 → 實作」的每一步都先落成書面規格並經人工審核後才往下走，讓 AI agent 在有明確、經核准邊界的規格下實作，同時搭配獨立於實作者的正式審查、每次除錯都以新鮮上下文重新檢視問題、以及交付前要求可驗證的新鮮證據而非單憑agent自述——整體效果是讓 AI 產出的程式碼維持可控、可追溯，且錯誤能在流程內被攔截，而不是把「AI 寫程式」變成一個黑箱。',
      },
      {
        kind: 'paragraph',
        text: '這個開發方式是否只是口號，關鍵在於專案的程式碼架構本身有沒有為此做設計。實際上，本專案的資料夾結構、命名慣例與檔案拆分顆粒度都高度一致且可預期：前端每個 feature 都放在 `apps/frontend/src/features/{name}/` 底下，並遵循相同骨架（`components/`、`pages/`、`hooks/` 或 `composables/`、`service.ts`、`queries.ts`／`mutations.ts`、`*Store.ts`）；命名慣例全面一致（元件用 PascalCase、hook 一律以 `use` 開頭、資料存取層固定叫單數的 `service.ts`、測試檔與被測檔同目錄並以 `*.test.tsx` 命名）；後端 NestJS 每個資源模組也固定是 `controller.ts`／`service.ts`／`module.ts` 三件套。這種高度可預測的結構讓 AI agent 在任何一個 feature 內都能依循相同慣例定位程式碼、新增檔案，大幅降低「每次都要重新摸索專案風格」的成本，也讓不同任務產出的程式碼風格保持一致。',
      },
      {
        kind: 'table',
        headers: ['架構規範', '目前做法'],
        rows: [
          [
            '單一元件行數上限',
            '`apps/frontend`、`apps/backend` 皆設有 `.eslintrc.json`，針對 `*.tsx`（測試檔除外）套用 `max-lines` 規則（上限 200 行），從架構層面限制單一元件的複雜度。',
          ],
          [
            'TechCard 元件顆粒度',
            '`TechCard.tsx` 只負責渲染；icon 來源編輯邏輯獨立為 `useIconSourceEditor.ts` hook、icon 來源彈出視窗獨立為 `IconSourcePopover.tsx`、meta 資訊呈現獨立為 `TechCardMeta.tsx`，各檔案單一職責。',
          ],
          [
            '篩選欄位的 debounce 與 store 同步邏輯',
            '共用的 `useDebouncedStoreSync` hook（`apps/frontend/src/hooks/`）統一處理「輸入防抖後寫回 store」，各篩選欄位呼叫同一個 hook，不各自重複實作。',
          ],
          [
            '後端管理員 email 判斷邏輯',
            '共用的 `isAdminEmail` helper（`apps/backend/src/features/auth/adminEmails.ts`）統一判斷邏輯，`AdminGuard` 與 `PermissionGuard` 皆呼叫同一函式。',
          ],
          [
            '頁面／分頁的捲動重置邏輯',
            '統一由 `utils/scroll.ts` 的 `scrollToTop()` 提供單一進入點；換頁由 `app/ScrollManager.tsx` 呼叫、換分頁由共用元件 `components/Pagination.tsx` 內建呼叫，新功能一律沿用，禁止在元件內各自寫 `window.scrollTo` 重新實作。',
          ],
          [
            '數字與日期的格式化邏輯',
            '統一由 `utils/format.ts` 提供（`toWan`／`toWanInt` 萬元格式、`formatNumber` 千分位、`formatDateInfo` 相對時間），前端規範明文禁止在元件內自行實作這些格式化邏輯，避免同一種顯示規則在各處長出不同版本。',
          ],
          [
            '關係圖表的渲染引擎',
            '本頁「雲端架構」「爬蟲流程」「資料正規化」「資料庫 schema」四種完全不同領域的圖表，共用同一套引擎（`components/diagram/` 下的 `DiagramCanvas.tsx`、`DiagramNodeDetail.tsx`、`useDiagramView.ts`）；新增一種圖表時只需提供該領域的 view composable、版面配置與圖示對照表，薄薄包一層即可重用整套渲染與互動邏輯，不需重寫圖表引擎。',
          ],
        ],
      },
    ],
  },
] as const;
