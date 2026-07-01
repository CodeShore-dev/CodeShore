import type {
  MetricExplanation,
  MetricKey,
} from '../content/types';

export const metricExplanations: Record<
  MetricKey,
  MetricExplanation
> = {
  'home.statRow': {
    key: 'home.statRow',
    title: '職缺數量',
    intro: '這一區四個數字的算法：',
    items: [
      {
        name: '全部職缺',
        detail: '站上收錄的所有職缺總數，不分開放或關閉。',
      },
      {
        name: '開放職缺',
        detail: '目前還在開放、尚未關閉的職缺數。',
      },
      {
        name: '月薪職缺',
        detail:
          '標示為月薪、且有明確薪資範圍的職缺數（薪資寫「面議」的不計入）。',
      },
      {
        name: '年薪職缺',
        detail:
          '標示為年薪、且有明確薪資範圍的職缺數（薪資寫「面議」的不計入）。',
      },
    ],
    note: '數字隨爬蟲抓到新職缺即時更新。',
    anchor: 'database',
    sqlObjects: ['get_job_count'],
  },
  'home.salaryBenchmark': {
    key: 'home.salaryBenchmark',
    title: '市場薪資行情',
    intro: '月薪與年薪分開計算，各自呈現以下水準：',
    items: [
      {
        name: '代表薪資',
        detail:
          '每筆職缺取薪資範圍的中間值；薪資寫「以上」則用「薪資範圍倍率」推估。',
      },
      {
        name: '中位數（PR50）',
        detail:
          '把所有代表薪資由低到高排，取正中間的值。',
      },
      {
        name: '偏高（PR75）',
        detail: '高過約 75% 職缺的薪資水準。',
      },
      {
        name: '頂端（PR88）',
        detail: '高過約 88% 職缺的薪資水準。',
      },
    ],
    note: '「以上」職缺會先用薪資範圍倍率推估薪資後納入；僅計入開放中、有薪資的職缺；資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_salary_type_median_ratio'],
  },
  'home.salaryRangeMultiplier': {
    key: 'home.salaryRangeMultiplier',
    title: '薪資範圍倍率',
    intro: '用來推估「面議／以上」職缺薪資的係數：',
    items: [
      {
        name: '怎麼算',
        detail:
          '取全站有明確薪資的職缺，算出每筆「最高薪 ÷ 最低薪」的比值，再加總平均（月薪、年薪分開計算）。',
      },
      {
        name: '代表什麼',
        detail:
          '最高薪平均是最低薪的幾倍。例如 1.8 倍代表最高薪約為最低薪的 1.8 倍。',
      },
      {
        name: '用途',
        detail:
          '「面議／以上」職缺只有最低薪，就用「最低薪 ×（1 ＋ 比率）÷ 2」推估它的平均薪資，讓這些職缺也能納入薪資統計，而非直接捨棄。',
      },
    ],
    note: '僅計入有明確薪資範圍的職缺；資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_salary_range_multiplier'],
  },
  'home.popularTech': {
    key: 'home.popularTech',
    title: '熱門技術',
    intro: '依職缺數排出最熱門的技術：',
    items: [
      {
        name: '職缺數',
        detail:
          '該技術出現在多少個職缺，同一個職缺只計一次。',
      },
      {
        name: '排名',
        detail: '依職缺數由多到少排序。',
      },
    ],
    note: '職缺數需達 8 筆以上才會列入；資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_tech_ranking'],
  },
  'home.highSalaryTech.year': {
    key: 'home.highSalaryTech.year',
    title: '高薪技術（年薪）',
    intro: '依年薪中位數排出最高薪的技術：',
    items: [
      {
        name: '中位數年薪（PR50）',
        detail:
          '該技術所有年薪職缺的代表薪資，取正中間的值。',
      },
      {
        name: '偏高年薪（PR75）',
        detail: '高過約 75% 該技術職缺的年薪水準。',
      },
      {
        name: '頂端年薪（PR88）',
        detail: '高過約 88% 該技術職缺的年薪水準。',
      },
      {
        name: '排名',
        detail: '依中位數年薪由高到低排序。',
      },
    ],
    note: '只列入職缺數達 8 筆、且年薪中位數高於全站年薪基準的技術；薪資寫「面議／以上」會先依市場行情推估。資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_tech_ranking'],
  },
  'home.highSalaryTech.month': {
    key: 'home.highSalaryTech.month',
    title: '高薪技術（月薪）',
    intro: '依月薪中位數排出最高薪的技術：',
    items: [
      {
        name: '中位數月薪（PR50）',
        detail:
          '該技術所有月薪職缺的代表薪資，取正中間的值。',
      },
      {
        name: '偏高月薪（PR75）',
        detail: '高過約 75% 該技術職缺的月薪水準。',
      },
      {
        name: '頂端月薪（PR88）',
        detail: '高過約 88% 該技術職缺的月薪水準。',
      },
      {
        name: '排名',
        detail: '依中位數月薪由高到低排序。',
      },
    ],
    note: '只列入職缺數達 8 筆、且月薪中位數高於全站月薪基準的技術；薪資寫「面議／以上」會先依市場行情推估。資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_tech_ranking'],
  },
  'home.hotCombos': {
    key: 'home.hotCombos',
    title: '熱門技術組合',
    intro: '找出最常一起出現在同一職缺的兩種技術：',
    items: [
      {
        name: '技術組合',
        detail:
          '同一職缺中同時出現的兩種技術，兩兩配對。',
      },
      {
        name: '職缺數',
        detail:
          '該組合出現在多少個職缺，同一個職缺只計一次。',
      },
      {
        name: '月／年薪',
        detail:
          '該組合職缺的薪資水準（中位數、偏高、頂端）。',
      },
      {
        name: '排名',
        detail: '依職缺數由多到少，預設取前 15 組。',
      },
    ],
    note: '組合需至少出現在 2 筆職缺；資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_tech_combo_stats'],
  },
  'techs.ranking': {
    key: 'techs.ranking',
    title: '技術排行',
    intro: '可切換「熱門」或「薪資」模式排序：',
    items: [
      {
        name: '職缺數',
        detail:
          '該技術出現在多少個職缺，同一個職缺只計一次。',
      },
      {
        name: '薪資（PR50／PR75／PR88）',
        detail:
          '該技術職缺的中位數、偏高、頂端薪資水準。',
      },
      {
        name: '排名',
        detail:
          '熱門模式依職缺數、薪資模式依薪資中位數，由高到低排序。',
      },
    ],
    note: '職缺數需達 8 筆以上才會列入；資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_tech_ranking'],
  },
  'techs.combos': {
    key: 'techs.combos',
    title: '技術組合',
    intro: '看所選語言最常搭配哪些其他技術：',
    items: [
      {
        name: '技術組合',
        detail: '所選語言搭配另一種「非語言」技術。',
      },
      {
        name: '職缺數',
        detail:
          '該組合出現在多少個職缺，同一個職缺只計一次。',
      },
      {
        name: '薪資（PR50／PR75／PR88）',
        detail:
          '該組合職缺的中位數、偏高、頂端薪資水準。',
      },
      {
        name: '排名',
        detail: '依職缺數由多到少排序。',
      },
    ],
    note: '組合需至少出現在 2 筆職缺；資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_tech_combo_stats'],
  },
  'company.list': {
    key: 'company.list',
    title: '公司列表',
    intro: '列出有在徵才的公司：',
    items: [
      {
        name: '收錄條件',
        detail:
          '至少有一筆開放中職缺的公司才會列入。',
      },
      {
        name: '職缺數',
        detail: '該公司目前開放中的職缺數。',
      },
      {
        name: '技術分布',
        detail:
          '該公司職缺用到的技術（去除重複）。',
      },
      {
        name: '排名',
        detail: '預設依職缺數由多到少排序。',
      },
    ],
    note: '資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_company'],
  },
  'job.list': {
    key: 'job.list',
    title: '職缺列表',
    intro: '列出開放中的職缺，可再用條件篩選：',
    items: [
      {
        name: '收錄條件',
        detail:
          '開放中的職缺；可再用地點、薪資、技術等條件縮小範圍。',
      },
      {
        name: '平均薪資',
        detail:
          '薪資範圍的中間值；薪資寫「面議／以上」依市場行情推估。',
      },
      {
        name: '排序',
        detail:
          '預設依平均薪資、最低薪、最高薪、更新時間由高到低。',
      },
    ],
    note: '資料定期更新。',
    anchor: 'database',
    sqlObjects: ['mv_job'],
  },
  'job.salary': {
    key: 'job.salary',
    title: '職缺薪資',
    intro: '單一職缺的薪資怎麼來：',
    items: [
      {
        name: '薪資範圍',
        detail:
          '由職缺薪資文字解析出的最低薪與最高薪。',
      },
      {
        name: '一般薪資',
        detail:
          '直接顯示薪資範圍，平均取範圍的中間值。',
      },
      {
        name: '面議／以上',
        detail:
          '以最低薪搭配市場行情推估代表薪資。',
      },
      {
        name: '市場行情',
        detail:
          '全站「最高薪相對最低薪」的平均倍率，當作推估係數。',
      },
    ],
    note: '薪資隨爬蟲更新；市場行情係數定期重新計算。',
    anchor: 'database',
    sqlObjects: [
      'mv_job',
      'mv_salary_range_multiplier'
    ],
  },
};
