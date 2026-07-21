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
          ['job', 'ix_job_min_salary_max_salary_updated_at (min_salary DESC, max_salary DESC, updated_at DESC)', '對齊 mv_job 定義裡的 ORDER BY，讓 REFRESH MATERIALIZED VIEW CONCURRENTLY 重建彙總結果時可利用索引順序、省去額外排序。「爬取時間／異動時間」欄位拆分將 job.updated_at 改名為 crawled_at 時，此索引第三欄曾隨欄位改名同步指向 crawled_at，與 mv_job 新的 updated_at（異動時間）排序脫鉤；已重建索引改回指向 updated_at，恢復原本的效能設計初衷。'],
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
      {
        kind: 'paragraph',
        text: '這套流程對「驗證」的要求同樣具體：agent 交付一項變更前，不能只憑「build 成功」「看起來合理」就宣稱完成，必須提出可重現的新鮮證據——而且證據要能排除「這個問題本來就存在、與這次改動無關」的可能。以一次實際的前端效能優化為例：',
      },
      {
        kind: 'table',
        headers: ['驗證方式', '具體做法與目的'],
        rows: [
          [
            '前後對照隔離既有問題',
            '改動後跑測試若出現失敗，先用 `git stash` 把這次改動暫時收起、在乾淨的基準版本上重跑同一批測試；若基準版本本來就失敗，才能確認失敗與這次改動無關，而不是把既有問題誤算進成果或誤判成新 bug。',
          ],
          [
            'Bundle 體積用視覺化報告佐證，不用猜的',
            'Vite build 接上 `rollup-plugin-visualizer`（`ANALYZE=true npx nx build frontend`，輸出 `dist/apps/frontend/stats.html` 的 treemap），直接在報告裡點出哪個第三方套件佔用了不成比例的體積，而不是憑印象猜測「應該是某個套件太大」。',
          ],
          [
            '執行期真實觀察，不只信賴編譯成功',
            '「typecheck／build 過」只代表程式碼合法，不代表功能真的如預期運作。例如替後端加上回應壓縮後，實際把服務跑起來、用 `curl -H "Accept-Encoding: gzip" -D - -o /dev/null <url>` 檢查回應標頭真的出現 `Content-Encoding: gzip`，而非只看到 build 沒報錯就視為完成。',
          ],
          [
            '影響範圍全掃過一輪，不只測被改到的檔案',
            '一項改動可能牽動共用元件、共用 hook 或跨專案的共用套件（如 `libs/service-utils` 同時被 `backend` 與 `backend-lambda` 使用），因此驗證會涵蓋所有可能受影響的專案（`nx run-many --target=typecheck`、對應的完整測試套件），而不是只跑被直接編輯的那個檔案的測試。',
          ],
        ],
      },
      {
        kind: 'paragraph',
        text: '這些報告與指令都可自行重現：本站的原始碼在「開源於 GitHub」頁面公開，任何人都能拉下程式碼、跑同樣的指令、看到同樣的輸出——這正是「公開透明」希望呈現的，不是單方面宣稱「AI 有做驗證」，而是驗證過程本身可被檢視、可被重做。',
      },
    ],
  },
  {
    id: 'analytics-debugging',
    title: '導入 GA4 追蹤的除錯紀錄',
    blocks: [
      {
        kind: 'paragraph',
        text: '本站導入 Google Analytics 4（GA4）流量追蹤時，功能程式碼（載入 gtag.js、設定 measurement ID、每次路由切換回報 page_view）在初次上線後完全沒有回報任何資料。這不是單一原因造成的，而是五層各自獨立、彼此疊加的問題；以下完整揭露每一層問題與排查過程，而不是只呈現「最後修好了」的結論——因為每一層在被發現前都曾讓人誤以為「已經修好」。',
      },
      {
        kind: 'table',
        headers: ['層', '問題', '如何發現', '修法'],
        rows: [
          [
            '① 建置期 secret 從未注入',
            '前端 VITE_GA_MEASUREMENT_ID 需在 Vite build 時就寫入 apps/frontend/.env，但當時的 CI 設定與 GCP Secret Manager 都還沒有這個項目，production bundle 裡這個值永遠是空字串，Analytics 元件的啟用判斷因而永遠為否，gtag.js 從未被載入。',
            '直接檢視 production 頁面原始碼，確認沒有任何 googletagmanager.com 的 script 標籤。',
            '在 GCP Secret Manager 建立對應 secret，並在 CI 設定中新增這個環境變數的注入步驟。',
          ],
          [
            '② Nx 遠端快取讓「修好」從未真正生效',
            '.env 檔案本身列在 .gitignore，而 Nx 預設以 Git 追蹤狀態計算任務快取鍵；.env 內容變動因此完全不影響快取鍵，Nx Cloud 遠端快取會直接回放前一次的建置產物，即使 secret 已經補齊，前端建置任務仍被判定為「命中快取」而跳過重新執行，新的 measurement ID 永遠沒有機會被真正打包進去。',
            '比對建置日誌逐行確認：Vite 的建置任務標示為「remote cache」而非真正重新執行；且重新觸發建置後產出的 JS 檔案雜湊值仍與修復前完全相同。',
            '在容器建置腳本中對前端建置任務加上略過 Nx 快取的旗標，確保每次映像建置都是真正重新執行、而不是回放舊產物。',
          ],
          [
            '③ CI 設定檔案跟實際執行的部署管線是兩回事',
            'repo 裡的 CI 設定檔（cloudbuild.yaml）看似已經包含新 secret 的注入步驟，但實際觸發部署的 Cloud Build trigger 本身另外存放了一份完全獨立、寫死在 trigger 設定裡的建置步驟，從未讀取這份 repo 檔案；換句話說，不論怎麼修改這份設定檔，實際部署管線根本沒有套用。',
            '比對建置日誌裡執行的步驟名稱與順序，發現跟 repo 設定檔完全對不上，才反查出 trigger 的設定來源。',
            '把 trigger 改為直接讀取 repo 內的 CI 設定檔，讓「修改設定檔」與「實際部署行為」重新變成同一件事——這個切換過程本身又額外挖出三個從未被真正執行過、因而從未被發現的潛伏問題（環境變數逸出符號寫錯、巢狀變數替換語法錯誤、映像路徑名稱大小寫不符），一併修正。',
          ],
          [
            '④ 正式流量當下實際走的是另一朵雲',
            '本站的對外流量由 Cloudflare Worker 依健康狀態在多雲（AWS／Azure／GCP）間自動容錯選路（見「雲端與 CI/CD 架構」段落）。修好 GCP 那條部署管線的當下，正式流量恰好被路由到尚未套用同一批修正的另一朵雲，因此使用者實際載入的仍是舊版本，完全沒有 gtag.js，跟「GCP 那邊到底修好了沒」無關。',
            '比對正式網域回應標頭裡標示的實際後端來源，與當時預期的目標雲不一致；直接開啟正式網域檢視原始碼，確認同樣沒有 gtag.js。',
            '確認另一朵雲的部署管線也拉到同一批修正、且同樣正確設定了 measurement ID 後，才視為全雲一致。',
          ],
          [
            '⑤ gtag.js 預設同意狀態為「拒絕」，且失敗不會有任何錯誤訊息',
            '前四層修完後，gtag.js 已正確載入、內部狀態也顯示設定指令有被處理，但瀏覽器從未寫入 GA4 用來識別使用者的 cookie，也從未真正送出量測請求——而且瀏覽器主控台沒有任何錯誤或警告。本站沒有 cookie 同意橫幅，程式碼裡也從未呼叫 gtag 的 consent 設定；gtag.js 在沒有收到明確同意信號時，預設會把 analytics_storage 視為「拒絕」，因而安靜地略過每一筆資料，不留下任何痕跡。',
            '在完全獨立、不含本站任何程式碼的乾淨網頁上重現同一組程式碼，用瀏覽器原生的 Performance Resource Timing API（而非仰賴任何開發工具擴充功能）驗證有無實際送出網路請求，逐行拿掉程式碼片段做排除法比對，最後用 GA4 即時報表確認資料是否真的送達，而不是只看「有沒有送出網路請求」這種容易誤判的間接訊號。',
            '在載入 gtag.js 後、送出任何設定或事件前，明確呼叫一次同意設定、將 analytics_storage 預設授予同意（廣告相關的同意項目維持拒絕，本站不需要）。',
          ],
        ],
      },
      {
        kind: 'paragraph',
        text: '這個過程之所以值得完整寫下來，不是因為問題本身特別罕見，而是因為每一層在被推翻之前，都曾經看起來「應該已經修好了」：程式碼審查看起來沒問題、建置紀錄顯示成功、頁面原始碼也確實出現了 script 標籤。真正找到下一層問題的方法，每次都是同一件事——不相信任何一層「看起來沒問題」的訊號，改用該層真正的、可重現的證據去驗證（建置日誌逐行核對、獨立環境重現、瀏覽器原生 API 交叉檢查、GA4 後台本身的即時報表），這與「開發方法論」段落所述「交付前必須提出可重現的新鮮證據」是同一套原則，只是這次套用在除錯一個橫跨五層基礎設施的問題上。',
      },
    ],
  },
  {
    id: 'seo',
    title: 'SEO 與可被搜尋性',
    blocks: [
      {
        kind: 'paragraph',
        text: '本站對搜尋引擎與社群分享的可見度，目前由以下幾層機制共同組成：',
      },
      {
        kind: 'list',
        items: [
          '每頁專屬 SEO metadata：所有公開頁面（首頁、職缺瀏覽、公司列表、技術熱度、公開透明、開源於 GitHub、隱私權與服務條款、聯絡我們）皆透過共用的 <PageSeo> 元件各自宣告自己的 title、description、canonical 網址與 hreflang（zh-TW／x-default），而非全站共用同一組標題描述。',
          'Open Graph／Twitter Card：<PageSeo> 同時輸出 og:title、og:description、og:image、twitter:card 等標籤，讓在 LINE、Slack、X 等平台分享連結時能正確顯示各頁自己的標題、描述與預覽圖，而非固定顯示首頁內容。',
          'JSON-LD structured data：首頁宣告 Organization 與帶 SearchAction 的 WebSite（讓 Google 有機會在搜尋結果直接顯示站內搜尋框）；職缺瀏覽、公司列表、技術熱度、公開透明與「關於」系列頁面則各自宣告 BreadcrumbList，對應該頁在網站架構中的層級路徑。',
          'Sitemap：public/sitemap.xml 列出全站可索引頁面（首頁、/jobs、/companies、/techs、/methodology、/open-source、/legal、/contact），並依各頁內容更新頻率標註 changefreq 與 priority，供搜尋引擎判斷收錄與重新爬取的優先順序。',
          'robots.txt：開放全站頁面被索引，僅排除 /admin（後台管理）、/auth（登入流程）、/keywords（技術詞庫管理）三個與一般訪客無關的路徑，並指向 sitemap.xml 的位置。',
        ],
      },
    ],
  },
] as const;
