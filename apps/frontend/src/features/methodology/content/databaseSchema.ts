/**
 * 「資料庫架構」關係圖的唯一可信來源（content registry）。
 *
 * 以與「資料來源與爬蟲」「資料正規化流程」相同的模式呈現：節點依群組框起來、節點間以箭頭
 * 表達關係；多視角（tab）共用同一組節點。三個 tab 分別揭露資料庫三層物件的關聯：
 *  - table：原始資料表之間的外鍵（FK）關聯。
 *  - matview：每個物化視圖（mv_*）由哪些資料表／物化視圖彙總而來。
 *  - function：每個 function 讀取哪些資料表／物化視圖（reset_keywords 另寫回 keyword）。
 *
 * 圖表、詳細面板皆只讀此模組，內容對齊 supabase/schema.sql 中實際存在的物件與關聯
 * （CREATE TABLE 的外鍵、CREATE MATERIALIZED VIEW 的來源表、CREATE FUNCTION 讀寫的物件）。
 *
 * 安全：本檔僅描述「結構與關聯」層級，不含任何金鑰、憑證、連線字串或可重現受保護操作的設定。
 * 語系：zh-TW。物件名稱（label）沿用資料庫實際命名以利對照 schema.sql。
 */

// 群組框：六類資料表 + 物化視圖（依關係再分四個子群組）+ function。
export type DbGroupId =
  | 'job' // 職缺核心
  | 'tech' // 技術字典
  | 'location' // 地點
  | 'pref' // 使用者偏好
  | 'source' // 爬蟲來源
  | 'ai' // AI 建議審核
  | 'mv-salary' // 物化視圖：薪資彙總
  | 'mv-job' // 物化視圖：職缺 / 公司彙總
  | 'mv-tech' // 物化視圖：技術彙總
  | 'mv-location' // 物化視圖：地點彙總
  | 'fn'; // function

export type DbViewId = 'table' | 'matview' | 'function';

// active=主要物件；shared=被多個 tab／流程共用的端點（資料表、物化視圖）
export type DbNodeStatus = 'active' | 'shared';

export interface DbNode {
  readonly id: string; // 穩定 id（沿用物件實際名稱），供 edge 與選取參照
  readonly label: string; // 顯示名稱（= 資料庫物件名稱）
  readonly group: DbGroupId;
  readonly status: DbNodeStatus;
  readonly interactive: boolean; // 是否可點看詳細
  readonly detail?: {
    // interactive 為 true 時必填（一致性測試強制）
    readonly role: string; // 物件角色（顯示於節點次行與詳細面板）
    readonly usage: string; // 用途與關聯說明；不得含機密
  };
}

export interface DbEdge {
  readonly from: string; // DbNode.id
  readonly to: string; // DbNode.id
  readonly label?: string; // 關係標註（FK 欄位／來源／讀寫）
}

export interface DbView {
  readonly id: DbViewId;
  readonly title: string; // tab 名稱
  readonly tiers: readonly (readonly string[])[]; // 分層順序，每層為 node id 陣列
  readonly clusterRows: readonly (readonly DbGroupId[])[]; // 群組框由上而下的流程列排列
  readonly edges: readonly DbEdge[];
}

export interface DatabaseSchema {
  readonly nodes: readonly DbNode[]; // 三視角共享節點集
  readonly views: Readonly<Record<DbViewId, DbView>>;
  readonly defaultView: DbViewId;
}

export const databaseSchema: DatabaseSchema = {
  nodes: [
    // ──────────── 資料表（table） ────────────
    {
      id: 'company',
      label: 'company',
      group: 'job',
      status: 'shared',
      interactive: true,
      detail: {
        role: '公司主表',
        usage:
          '存公司 id、名稱、連結、類型；被 job.company_id 參照（FK）。供公司列表與職缺帶出公司資訊，並為 mv_job／mv_company 提供公司欄位。',
      },
    },
    {
      id: 'job',
      label: 'job',
      group: 'job',
      status: 'shared',
      interactive: true,
      detail: {
        role: '職缺主表・所有分析的事實來源',
        usage:
          '保存標題、地點、薪資原字串與解析出的 min/max_salary、salary_type、職缺描述、closed 等；以 company_id 外鍵連向 company。是所有物化視圖與多數 function 的事實基礎。',
      },
    },
    {
      id: 'job_keyword',
      label: 'job_keyword',
      group: 'job',
      status: 'shared',
      interactive: true,
      detail: {
        role: '每筆職缺關鍵字',
        usage:
          '主鍵 id 同時外鍵連向 job.id；保存萃取出的 keywords[] 與中英文比例（description_ch_en_ratio）。供 reset_keywords 重建字典、並為 mv_job 帶入中英比例。',
      },
    },
    {
      id: 'job_description_bin',
      label: '[AI] job_description_bin',
      group: 'job',
      status: 'active',
      interactive: true,
      detail: {
        role: '排除用職缺描述清單',
        usage:
          '用來排除職缺描述內容的雜訊，例如：註明職缺負責人是擅長 xxx 技術領域的獵人頭，但職缺不一定需要具備 xxx 技術。',
      },
    },
    {
      id: 'tech',
      label: '[AI] tech',
      group: 'tech',
      status: 'shared',
      interactive: true,
      detail: {
        role: '標準技術字典',
        usage:
          '主鍵 id；存技術的分類（category）、標籤（tags）與圖示（icon_slugs）。被 job_tech、tech_keyword、tech_parent 參照，是技術排行與分類彙總的基礎。',
      },
    },
    {
      id: 'keyword',
      label: 'keyword',
      group: 'tech',
      status: 'shared',
      interactive: true,
      detail: {
        role: '關鍵字字典＋出現次數',
        usage:
          '主鍵 id；存各關鍵字與 count。由 reset_keywords() 從 job_keyword 展開聚合重建；被 tech_keyword.keyword 參照，供 mv_tech 聚合。',
      },
    },
    {
      id: 'keyword_bin',
      label: '[AI] keyword_bin',
      group: 'tech',
      status: 'active',
      interactive: true,
      detail: {
        role: '排除用關鍵字清單',
        usage: '主鍵 id；列出技術彙總時要排除的雜訊關鍵字，mv_tech 以 keyword_bin 過濾。無對外外鍵。',
      },
    },
    {
      id: 'tech_keyword',
      label: '[AI] tech_keyword',
      group: 'tech',
      status: 'shared',
      interactive: true,
      detail: {
        role: '關鍵字 → 技術 映射',
        usage:
          '主鍵 (tech, keyword)；外鍵 tech→tech、keyword→keyword。把零散關鍵字歸併到標準技術，是 mv_tech 聚合與 reset_keywords 補字典的依據。',
      },
    },
    {
      id: 'tech_parent',
      label: '[AI] tech_parent',
      group: 'tech',
      status: 'active',
      interactive: true,
      detail: {
        role: '技術之間的父子階層',
        usage:
          '主鍵 (parent, child)；parent 與 child 皆外鍵連向 tech。維護技術階層（如語言↔框架），供 mv_tech 帶出 parents／children 並用於技術組合判斷。',
      },
    },
    {
      id: 'job_tech',
      label: 'job_tech',
      group: 'tech',
      status: 'shared',
      interactive: true,
      detail: {
        role: '職缺 × 技術 對應',
        usage:
          '主鍵 (job_id, tech)；外鍵 job_id→job、tech→tech。每筆職缺對應一或多個技術，是技術排行（mv_tech_ranking）與技術組合（mv_tech_combo_stats）統計的連結基礎。',
      },
    },
    {
      id: 'location_group',
      label: '[AI] location_group',
      group: 'location',
      status: 'shared',
      interactive: true,
      detail: {
        role: '正規化後的地點群組',
        usage:
          '主鍵 id；標準地點群組。被 location_group_location.location_group 參照，供 mv_job／mv_location_group 帶出正規化地點。',
      },
    },
    {
      id: 'location_group_location',
      label: '[AI] location_group_location',
      group: 'location',
      status: 'shared',
      interactive: true,
      detail: {
        role: '雜亂地點字串 → 群組 對應',
        usage:
          '主鍵 (location_group, location)；location_group 外鍵連向 location_group。把 job.location 的雜亂字串對應到標準群組，供地點維度彙總與地點異常檢查。',
      },
    },
    {
      id: 'job_preference',
      label: 'job_preference',
      group: 'pref',
      status: 'shared',
      interactive: true,
      detail: {
        role: '使用者對職缺的標記',
        usage:
          '主鍵 (job_id, user_id)；外鍵 job_id→job、user_id→auth.users。記錄登入者對職缺的 like／dislike，供偏好相關 function 取用。',
      },
    },
    {
      id: 'job_source',
      label: 'job_source',
      group: 'source',
      status: 'active',
      interactive: true,
      detail: {
        role: '爬蟲來源清單',
        usage: '主鍵 url；列出爬蟲要抓取的來源列表頁 URL。',
      },
    },
    {
      id: 'job_source_url',
      label: 'job_source_url',
      group: 'source',
      status: 'active',
      interactive: true,
      detail: {
        role: '列表頁抓取進度',
        usage: '主鍵 (url, page_index)；以 status（pending／completed／failed）記錄各列表頁抓取進度，供爬蟲斷點續抓。',
      },
    },
    {
      id: 'job_filter_subscription',
      label: 'job_filter_subscription',
      group: 'pref',
      status: 'active',
      interactive: true,
      detail: {
        role: '使用者關注的篩選組合',
        usage:
          '主鍵 id；user_id 外鍵連向 auth.users。存正規化後的篩選快照、已推導的職缺查詢條件、顯示標籤與最後檢視時間，供「篩選組合關注清單」頁計算最後檢視後新增的符合職缺數。',
      },
    },

    // ──────────── AI 建議審核 ────────────
    {
      id: 'ai_llm_setting',
      label: '[AI] ai_llm_setting',
      group: 'ai',
      status: 'active',
      interactive: true,
      detail: {
        role: 'AI 建議產生器可調設定',
        usage:
          '主鍵 key；存放可由後台調整的設定值（如目前用於產生建議的預設 LLM model），調整後立即生效、無需重新部署。無對外外鍵。',
      },
    },
    {
      id: 'ai_suggestion',
      label: '[AI] ai_suggestion',
      group: 'ai',
      status: 'active',
      interactive: true,
      detail: {
        role: 'AI 建議審核佇列',
        usage:
          '主鍵 id；記錄 AI 針對技術字典、關鍵字對應、地點正規化等提出的建議內容（目標資料表、動作、payload）與判斷依據（evidence），reviewed_by 外鍵連向 auth.users。僅在管理員核准後才會寫入對應目標資料表（如 tech、tech_keyword、tech_parent、location_group(_location)、job_description_bin、keyword_bin）。',
      },
    },

    // ──────────── 物化視圖（materialized view） ────────────
    {
      id: 'mv_salary_range_multiplier',
      label: 'mv_salary_range_multiplier',
      group: 'mv-salary',
      status: 'shared',
      interactive: true,
      detail: {
        role: '薪資範圍倍率',
        usage:
          '各薪資型態（月／年）的「最高薪 ÷ 最低薪」平均倍率。來源：job。用來推估「面議／以上」職缺薪資，並被 mv_job、mv_salary_type_median_ratio 取用。',
      },
    },
    {
      id: 'mv_tech',
      label: 'mv_tech',
      group: 'mv-tech',
      status: 'shared',
      interactive: true,
      detail: {
        role: '技術彙總',
        usage:
          '每個技術的總出現次數、所屬關鍵字、階層與標籤／圖示。來源：keyword、keyword_bin、tech_keyword、tech、tech_parent。供技術熱度，並作為 mv_tech_combo_stats 的基底。',
      },
    },
    {
      id: 'mv_job',
      label: 'mv_job',
      group: 'mv-job',
      status: 'shared',
      interactive: true,
      detail: {
        role: '對外職缺視圖',
        usage:
          '併入公司資訊、正規化地點與技術陣列，並對「面議／以上」薪資以薪資範圍倍率補上推估平均薪資。來源：job、job_keyword、company、job_tech、location_group(_location)、mv_salary_range_multiplier。供職缺列表與篩選。',
      },
    },
    {
      id: 'mv_company',
      label: 'mv_company',
      group: 'mv-job',
      status: 'active',
      interactive: true,
      detail: {
        role: '公司彙總',
        usage: '每間公司的有效（開放中）職缺數與技術分布。來源：company、job、job_tech。供公司列表。',
      },
    },
    {
      id: 'mv_company_tech',
      label: 'mv_company_tech',
      group: 'mv-job',
      status: 'active',
      interactive: true,
      detail: {
        role: '公司 × 技術 職缺數彙總',
        usage:
          '每間公司底下各技術的有效（開放中）職缺數，依職缺數由多到少排序。來源：company、job、job_tech。供公司詳情頁的技術分布統計。',
      },
    },
    {
      id: 'mv_salary_type_median_ratio',
      label: 'mv_salary_type_median_ratio',
      group: 'mv-salary',
      status: 'active',
      interactive: true,
      detail: {
        role: '薪資基準（PR50／PR75／PR88）',
        usage: '依薪資型態預先算好中位／偏高／頂端薪資。來源：job、mv_salary_range_multiplier。供首頁薪資基準分析。',
      },
    },
    {
      id: 'mv_tech_combo_stats',
      label: 'mv_tech_combo_stats',
      group: 'mv-tech',
      status: 'shared',
      interactive: true,
      detail: {
        role: '技術組合統計',
        usage: '技術兩兩組合的職缺數與月／年薪各百分位。來源：job_tech、job、mv_tech。供熱門技術組合分析。',
      },
    },
    {
      id: 'mv_tech_ranking',
      label: 'mv_tech_ranking',
      group: 'mv-tech',
      status: 'active',
      interactive: true,
      detail: {
        role: '技術排行',
        usage: '各技術的職缺數與月／年薪各百分位（PR50／PR75／PR88）。來源：job_tech、job、tech。供技術排行頁。',
      },
    },
    {
      id: 'mv_tech_category',
      label: 'mv_tech_category',
      group: 'mv-tech',
      status: 'active',
      interactive: true,
      detail: {
        role: '技術分類計數',
        usage: '各 category 的技術數。來源：tech。供分類維度彙總。',
      },
    },
    {
      id: 'mv_tech_tags',
      label: 'mv_tech_tags',
      group: 'mv-tech',
      status: 'active',
      interactive: true,
      detail: {
        role: '技術標籤計數',
        usage: '各標籤（tag）的計數。來源：tech（展開 tags）。供標籤維度彙總。',
      },
    },
    {
      id: 'mv_location_group',
      label: 'mv_location_group',
      group: 'mv-location',
      status: 'active',
      interactive: true,
      detail: {
        role: '地點分布',
        usage: '各地點群組的職缺數。來源：job、location_group(_location)。供地點維度彙總。',
      },
    },

    // ──────────── function ────────────
    {
      id: 'get_job_count',
      label: 'get_job_count',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '職缺統計列',
        usage: '回傳全部／開放中／月薪／年薪可分析職缺數。讀自 job。供首頁統計列。',
      },
    },
    {
      id: 'get_job_crawl_stats',
      label: 'get_job_crawl_stats',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '抓取統計',
        usage: '回傳近 N 天新增／更新職缺數。讀自 job。供爬蟲監測。',
      },
    },
    {
      id: 'get_job_host_statistics',
      label: 'get_job_host_statistics',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '來源佔比',
        usage: '依 detail_link 的 host 統計各來源職缺數與佔比。讀自 job。供「資料來源與爬蟲」區塊的即時來源佔比。',
      },
    },
    {
      id: 'get_job_update_date_counts',
      label: 'get_job_update_date_counts',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '更新日期分布',
        usage: '依 updated_at 日期統計職缺數。讀自 job。',
      },
    },
    {
      id: 'get_job_preference_count',
      label: 'get_job_preference_count',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '偏好計數',
        usage: '回傳某使用者的 like／dislike 數（僅計開放中職缺）。讀自 job_preference、job。',
      },
    },
    {
      id: 'get_jobs_by_preference',
      label: 'get_jobs_by_preference',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '取已標記職缺',
        usage: '依使用者標記（like／dislike）取出職缺。讀自 mv_job、job_preference。',
      },
    },
    {
      id: 'get_unreviewed_jobs',
      label: 'get_unreviewed_jobs',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '取未檢視職缺',
        usage: '取出使用者尚未標記過的職缺。讀自 mv_job、job_preference。',
      },
    },
    {
      id: 'get_location_anomaly_jobs',
      label: 'get_location_anomaly_jobs',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '地點異常職缺',
        usage: '找出地點為空／未對應群組／過長的職缺。讀自 job、location_group_location。供地點正規化檢查。',
      },
    },
    {
      id: 'reset_keywords',
      label: 'reset_keywords',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '重建關鍵字字典',
        usage:
          '把 job_keyword.keywords 展開聚合重算次數、補上 tech_keyword 中未出現的關鍵字，重建 keyword 表。讀自 job_keyword、tech_keyword，寫入 keyword。',
      },
    },
    {
      id: 'detect_tech_parent_cycle',
      label: 'detect_tech_parent_cycle',
      group: 'fn',
      status: 'active',
      interactive: true,
      detail: {
        role: '技術階層循環偵測',
        usage:
          '給定欲新增的 parent／child，沿既有 tech_parent 邊遞迴走訪，找出是否會形成循環階層並回傳衝突路徑。讀自 tech_parent；供核准「新增技術父子關聯」類 AI 建議前的寫入前檢查，偵測到循環即擋下、不寫入。',
      },
    },
  ],
  views: {
    // tab 1：資料表外鍵關聯（依領域分群組框，箭頭 parent → child 表示被哪張表以哪個欄位參照）
    table: {
      id: 'table',
      title: '資料表關聯',
      tiers: [
        ['company', 'job', 'job_tech', 'keyword_bin', 'location_group', 'job_source'],
        ['keyword', 'location_group_location', 'tech', 'job_source_url'],
        ['job_description_bin', 'job_keyword', 'tech_keyword', 'tech_parent', 'job_preference', 'job_filter_subscription'],
        ['ai_llm_setting', 'ai_suggestion'],
      ],
      clusterRows: [
        ['job', 'tech'],
        ['location', 'pref', 'source'],
        ['ai'],
      ],
      edges: [
        { from: 'company', to: 'job', label: 'company.id<->job.company_id' },
        { from: 'job', to: 'job_keyword', label: 'job.id<->job_keyword.job_id' },
        { from: 'job_keyword', to: 'keyword', label: '將 keyword 分組再計算數量' },
        { from: 'job', to: 'job_tech', label: 'job.id<->job_tech.job_id' },
        { from: 'tech', to: 'job_tech', label: 'tech.id<->job_tech:tech' },
        { from: 'job', to: 'job_preference', label: 'job.id<->job_preference.job_id' },
        { from: 'tech', to: 'tech_keyword', label: 'tech.id<->tech_keyword.tech' },
        { from: 'keyword', to: 'tech_keyword', label: 'keyword.id<->tech_keyword.keyword' },
        { from: 'tech', to: 'tech_parent', label: 'tech.id<->tech_parent.parent' },
        { from: 'tech', to: 'tech_parent', label: 'tech.id<->tech_parent.child' },
        {
          from: 'location_group',
          to: 'location_group_location',
          label: 'location_group.id<->location_group_location.location_group',
        },
      ],
    },
    // tab 2：物化視圖來源（來源資料表／物化視圖 → mv_*，箭頭表示「彙總自」）
    matview: {
      id: 'matview',
      title: '物化視圖來源',
      tiers: [
        // tier0：來源（左→右：地點 → 職缺 → 技術）。job 置於職缺框最右、job_tech 置於技術框最左，
        // 讓「職缺↔技術」的跨框邊（mv_company／mv_tech_combo_stats／mv_tech_ranking 等）最短、減少交錯。
        [
          'location_group',
          'location_group_location',
          'job_keyword',
          'company',
          'job',
          'job_tech',
          'keyword',
          'keyword_bin',
          'tech_keyword',
          'tech_parent',
          'tech',
        ],
        // tier1：會被其他 mv 取用的一級物化視圖（排在各自群組框上排）
        ['mv_salary_range_multiplier', 'mv_tech'],
        // tier2：二級物化視圖，依群組框左→右排列，使每個 mv 盡量對齊其上游來源的水平位置
        [
          'mv_location_group',
          'mv_job',
          'mv_company',
          'mv_company_tech',
          'mv_salary_type_median_ratio',
          'mv_tech_combo_stats',
          'mv_tech_ranking',
          'mv_tech_category',
          'mv_tech_tags',
        ],
      ],
      clusterRows: [
        ['location', 'job', 'tech'],
        ['mv-location', 'mv-job', 'mv-salary', 'mv-tech'],
      ],
      edges: [
        // mv_salary_range_multiplier
        { from: 'job', to: 'mv_salary_range_multiplier' },
        // mv_tech
        { from: 'keyword', to: 'mv_tech' },
        { from: 'keyword_bin', to: 'mv_tech' },
        { from: 'tech_keyword', to: 'mv_tech' },
        { from: 'tech', to: 'mv_tech' },
        { from: 'tech_parent', to: 'mv_tech' },
        // mv_company
        { from: 'company', to: 'mv_company' },
        { from: 'job', to: 'mv_company' },
        { from: 'job_tech', to: 'mv_company' },
        // mv_company_tech
        { from: 'company', to: 'mv_company_tech' },
        { from: 'job', to: 'mv_company_tech' },
        { from: 'job_tech', to: 'mv_company_tech' },
        // mv_job
        { from: 'job', to: 'mv_job' },
        { from: 'job_keyword', to: 'mv_job' },
        { from: 'company', to: 'mv_job' },
        { from: 'job_tech', to: 'mv_job' },
        { from: 'location_group_location', to: 'mv_job' },
        { from: 'location_group', to: 'mv_job' },
        { from: 'mv_salary_range_multiplier', to: 'mv_job', label: '推估倍率' },
        // mv_location_group
        { from: 'job', to: 'mv_location_group' },
        { from: 'location_group_location', to: 'mv_location_group' },
        { from: 'location_group', to: 'mv_location_group' },
        // mv_salary_type_median_ratio
        { from: 'job', to: 'mv_salary_type_median_ratio' },
        { from: 'mv_salary_range_multiplier', to: 'mv_salary_type_median_ratio', label: '推估倍率' },
        // mv_tech_category
        { from: 'tech', to: 'mv_tech_category' },
        // mv_tech_combo_stats
        { from: 'job_tech', to: 'mv_tech_combo_stats' },
        { from: 'job', to: 'mv_tech_combo_stats' },
        { from: 'mv_tech', to: 'mv_tech_combo_stats', label: '技術基底' },
        // mv_tech_ranking
        { from: 'job_tech', to: 'mv_tech_ranking' },
        { from: 'job', to: 'mv_tech_ranking' },
        { from: 'tech', to: 'mv_tech_ranking' },
        // mv_tech_tags
        { from: 'tech', to: 'mv_tech_tags' },
      ],
    },
    // tab 3：function 讀寫（function 由上排資料物件向下讀取；reset_keywords 另寫回 keyword）
    function: {
      id: 'function',
      title: 'Function 讀寫',
      // 兩層版面：上排＝function 讀取的資料物件（資料表＋被讀取的物化視圖 mv_job），
      // 下排＝function。依「哪個 function 讀哪些物件」排列，讓讀取邊盡量短、減少交錯。
      tiers: [
        [
          'mv_job',
          'job_preference',
          'job',
          'job_keyword',
          'location_group_location',
          'keyword',
          'tech_keyword',
          'tech_parent',
        ],
        [
          'get_jobs_by_preference',
          'get_unreviewed_jobs',
          'get_job_preference_count',
          'get_job_count',
          'get_job_host_statistics',
          'get_job_update_date_counts',
          'get_job_crawl_stats',
          'get_location_anomaly_jobs',
          'reset_keywords',
          'detect_tech_parent_cycle',
        ],
      ],
      clusterRows: [['mv-tech', 'mv-job', 'pref', 'job', 'location', 'tech'], ['fn']],
      edges: [
        // 讀取型 function（讀自資料表）
        { from: 'job', to: 'get_job_crawl_stats', label: '讀取' },
        { from: 'job', to: 'get_job_host_statistics', label: '讀取' },
        { from: 'job', to: 'get_job_update_date_counts', label: '讀取' },
        { from: 'job', to: 'get_location_anomaly_jobs', label: '讀取' },
        { from: 'location_group_location', to: 'get_location_anomaly_jobs', label: '讀取' },
        // 讀取型 function（讀自物化視圖）
        { from: 'mv_job', to: 'get_jobs_by_preference', label: '讀取' },
        { from: 'job_preference', to: 'get_jobs_by_preference', label: '讀取' },
        { from: 'mv_job', to: 'get_unreviewed_jobs', label: '讀取' },
        { from: 'job_preference', to: 'get_unreviewed_jobs', label: '讀取' },
        { from: 'mv_job', to: 'get_job_count', label: '讀取' },
        { from: 'mv_job', to: 'get_job_preference_count', label: '讀取' },
        { from: 'job_preference', to: 'get_job_preference_count', label: '讀取' },
        // reset_keywords：讀 job_keyword／tech_keyword、寫 keyword
        { from: 'job_keyword', to: 'reset_keywords', label: '讀取' },
        { from: 'tech_keyword', to: 'reset_keywords', label: '讀取' },
        { from: 'reset_keywords', to: 'keyword', label: '重建' },
        // detect_tech_parent_cycle：讀 tech_parent（不寫入，僅供核准前檢查）
        { from: 'tech_parent', to: 'detect_tech_parent_cycle', label: '讀取' },
      ],
    },
  },
  defaultView: 'table',
};
