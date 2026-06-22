import type {
  MetricExplanation,
  MetricKey,
} from '../content/types';

/**
 * 逐區計算說明登錄表（zh-TW）的唯一可信來源。
 *
 * 每個分析區塊（MetricKey）對應一筆說明，內容反映該數字在站台中的「實際」
 * 推導：其背後的物化視圖（materialized view）/ function / 公式，與 schema.sql
 * 及各 feature service 的取數邏輯一致（需求 8.1 / 8.2）。
 *
 * 採 `Record<MetricKey, MetricExplanation>` 強制覆蓋所有 MetricKey；
 * 任一鍵缺漏皆會產生 TS 編譯錯誤。各分析數字皆源自資料庫的彙總視圖 /
 * function，因此 anchor 一律指向 Methodology 頁的「資料庫架構」段落
 * （`database`），該段才有對應的 MV / function 說明。
 *
 * 本檔僅描述方法與口徑，不含任何金鑰、憑證或連線字串。
 */
export const metricExplanations: Record<
  MetricKey,
  MetricExplanation
> = {
  'home.statRow': {
    key: 'home.statRow',
    title: '首頁統計列（職缺數）',
    source: 'function get_job_count()',
    scope:
      '全站 job 資料表的所有職缺，並區分開放中（closed = false）與可分析薪資職缺。',
    formula:
      '回傳四個計數：職缺總數、開放中職缺數，以及月薪 / 年薪可分析職缺數（薪資型態為 month / year、min_salary 不為 0、max_salary 不為「面議 / 以上」哨兵值 9999999）。',
    aggregation:
      'COUNT(*) 搭配 FILTER 條件，於資料庫一次算出各項計數。',
    updateFrequency:
      '由 function 即時讀取 job 資料表，因此數字隨爬蟲寫入 job 後即更新（不經物化視圖快取）。',
    anchor: 'database',
  },
  'home.salaryBenchmark': {
    key: 'home.salaryBenchmark',
    title: '首頁薪資基準',
    source: '物化視圖 mv_salary_type_median_ratio',
    scope:
      '開放中（closed = false）、薪資型態為月薪或年薪、且能取得代表薪資的職缺。',
    formula:
      '先為每筆職缺算出代表薪資：一般職缺取 (min_salary + max_salary) / 2；「面議 / 以上」（max_salary = 9999999）職缺則以 min_salary × (1 + 市場加權比率) / 2 推估（加權比率來自 mv_salary_weighted_ratio）。再對代表薪資取 PR50（中位 median_mark）、PR75（high_mark）、PR88（top_mark）。',
    aggregation:
      '依薪資型態（月薪 / 年薪）分組，以 percentile_cont 計算各百分位後四捨五入。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_salary_type_median_ratio，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'home.popularTech': {
    key: 'home.popularTech',
    title: '首頁熱門技術',
    source: '物化視圖 mv_keyword_group_ranking',
    scope:
      '依所選分類（category）篩選的技術群組，且該群組職缺數達門檻（job_count ≥ 8）。',
    formula:
      '以每個技術群組關聯的職缺數（job_count）由多到少排序，取前幾名做為熱門技術。職缺數為該技術群組所對應職缺的去重計數。',
    aggregation:
      '以 job_keyword_group 將職缺對應到技術群組，COUNT(DISTINCT job_id) 算出各群組職缺數，並依 job_count 由大到小排序。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_keyword_group_ranking，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'home.highSalaryTech.year': {
    key: 'home.highSalaryTech.year',
    title: '首頁高薪技術（年薪）',
    source: '物化視圖 mv_keyword_group_ranking（年薪欄位）',
    scope:
      '年薪職缺中、職缺數達門檻（job_count ≥ 8），且年薪中位數（year_median_avg）不低於全站年薪基準中位數的技術群組。',
    formula:
      '對每個技術群組的年薪職缺取 (年薪 min + 年薪 max) / 2 後算出各百分位：year_median_avg（PR50）、year_pr75_avg（PR75）、year_pr88_avg（PR88）；「面議 / 以上」職缺在進入薪資基準前已先以市場加權比率（mv_salary_weighted_ratio）推估代表薪資。依 year_median_avg 由高到低排序，呈現高薪技術。',
    aggregation:
      '依技術群組分組，以 percentile_cont 取年薪 min / max 的 PR50 / PR75 / PR88 後平均並四捨五入；過濾條件為 year_median_avg ≥ 年薪基準中位數。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_keyword_group_ranking，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'home.highSalaryTech.month': {
    key: 'home.highSalaryTech.month',
    title: '首頁高薪技術（月薪）',
    source: '物化視圖 mv_keyword_group_ranking（月薪欄位）',
    scope:
      '月薪職缺中、職缺數達門檻（job_count ≥ 8），且月薪中位數（month_median_avg）不低於全站月薪基準中位數的技術群組。',
    formula:
      '對每個技術群組的月薪職缺取 (月薪 min + 月薪 max) / 2 後算出各百分位：month_median_avg（PR50）、month_pr75_avg（PR75）、month_pr88_avg（PR88）；「面議 / 以上」職缺在進入薪資基準前已先以市場加權比率（mv_salary_weighted_ratio）推估代表薪資。依 month_median_avg 由高到低排序，呈現高薪技術。',
    aggregation:
      '依技術群組分組，以 percentile_cont 取月薪 min / max 的 PR50 / PR75 / PR88 後平均並四捨五入；過濾條件為 month_median_avg ≥ 月薪基準中位數。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_keyword_group_ranking，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'home.hotCombos': {
    key: 'home.hotCombos',
    title: '首頁熱門技術組合',
    source:
      '物化視圖 mv_tech_combo_stats（亦可經 function get_tech_combo_stats）',
    scope:
      '同一職缺中「兩兩共同出現」的技術群組組合，且該組合職缺數達門檻（去重職缺數 ≥ 2）。',
    formula:
      '對每筆職缺取其技術群組的兩兩配對（依群組階層關係配對），統計各組合的職缺數與月 / 年薪各百分位，並以職缺數（job_count）由多到少排序取前幾名做為熱門組合。',
    aggregation:
      '以 job_keyword_group 自連接產生技術配對，COUNT(DISTINCT job_id) 算出組合職缺數；get_tech_combo_stats 預設取職缺數最多的前 15 筆（p_limit DEFAULT 15）。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_tech_combo_stats，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'techs.ranking': {
    key: 'techs.ranking',
    title: '技術排行頁',
    source: '物化視圖 mv_keyword_group_ranking',
    scope:
      '依所選分類（category）篩選、職缺數達門檻（job_count ≥ 8）的技術群組；薪資模式（年薪 / 月薪）下另以對應薪資中位數過濾。',
    formula:
      '熱門模式以職缺數（job_count）由多到少排序；薪資模式以對應的年薪 / 月薪中位數（year_median_avg / month_median_avg）由高到低排序，並可顯示 PR50 / PR75 / PR88 三檔薪資。整頁分頁瀏覽並回傳總筆數。',
    aggregation:
      '同熱門技術：以 job_keyword_group 對應職缺到群組，COUNT(DISTINCT job_id) 算職缺數、percentile_cont 算各百分位薪資。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_keyword_group_ranking，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'techs.combos': {
    key: 'techs.combos',
    title: '技術組合頁',
    source: '物化視圖 mv_tech_combo_stats',
    scope:
      '以所選語言（tech1）為主、且搭配的另一技術非語言類（cat2 ≠ language）的兩兩技術組合，組合職缺數達門檻（去重職缺數 ≥ 2）。',
    formula:
      '對選定技術，列出其與其他技術共同出現的組合，統計各組合職缺數與月 / 年薪百分位，依職缺數（job_count）由多到少排序並分頁；語言清單同樣取自技術排行（語言分類、job_count ≥ 8）。',
    aggregation:
      '以 job_keyword_group 自連接產生技術配對，COUNT(DISTINCT job_id) 算組合職缺數、percentile_cont 算各百分位薪資。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_tech_combo_stats，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'company.list': {
    key: 'company.list',
    title: '公司列表',
    source: '物化視圖 mv_company',
    scope:
      '至少有一筆開放中職缺（closed = false）的公司；無開放職缺者不列入。',
    formula:
      '每間公司彙總其開放中職缺數（job_count）與技術群組分布（keyword_groups）。預設以職缺數由多到少排序（job_count:desc），其次以公司 id。',
    aggregation:
      '以 company JOIN job JOIN job_keyword_group，依公司分組，COUNT(DISTINCT job_id) 算職缺數、array_agg(DISTINCT keyword_group) 收集技術群組，並以 HAVING 過濾職缺數為 0 的公司。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_company，以 CONCURRENTLY 方式）時更新。',
    anchor: 'database',
  },
  'job.list': {
    key: 'job.list',
    title: '職缺列表',
    source: '物化視圖 mv_job',
    scope:
      '開放中（closed = false）的職缺；可再經使用者選取的篩選條件（地點、薪資、技術群組等）縮小範圍。',
    formula:
      '以 mv_job 為對外職缺視圖，已併入公司資訊、正規化地點與技術群組陣列。預設排序為推估平均薪資、最低薪、最高薪、更新時間皆由高到低（avg_salary:desc;min_salary:desc;max_salary:desc;updated_at:desc）。',
    aggregation:
      '於 mv_job 內以 job JOIN company / job_keyword / location_group 等並依職缺分組彙總；篩選與排序在查詢時套用，列表結果分頁回傳。',
    updateFrequency:
      '資料於後端重新整理 materialized view（refresh_mv_job，以 CONCURRENTLY 方式）時更新；使用者偏好等即時資訊另行查詢。',
    anchor: 'database',
  },
  'job.salary': {
    key: 'job.salary',
    title: '職缺薪資',
    source:
      'mv_job 的薪資欄位（min_salary / max_salary / salary_type / avg_salary），推估時參照 mv_salary_weighted_ratio',
    scope:
      '單筆職缺的薪資；薪資字串於爬蟲端解析為 min_salary / max_salary 與薪資型態（月薪 / 年薪），「面議 / 以上」以哨兵值 9999999 表示。',
    formula:
      '一般職缺直接呈現解析出的薪資區間並以 (min_salary + max_salary) / 2 取平均（avg_salary）；「面議 / 以上」（max_salary = 9999999）職缺則以 min_salary × (1 + 市場加權比率) / 2 推估代表平均薪資，市場加權比率採「Σ(比例 × 該比例人數) ÷ 總人數」（get_weighted_market_ratio / mv_salary_weighted_ratio）。',
    aggregation:
      '單筆職缺層級的計算；市場加權比率為全站（依薪資型態）對「最高薪 / 最低薪」比值的加權平均，做為推估「面議 / 以上」薪資的係數。',
    updateFrequency:
      '解析後的薪資隨爬蟲更新 job 後反映，並於重新整理 mv_job 時帶入列表；加權比率於重新整理 mv_salary_weighted_ratio 時更新。',
    anchor: 'database',
  },
};
