// 涵蓋所有非後台分析頁的分析區塊；查無對應者 InfoHint 不渲染（8.3）
export type MetricKey =
  | 'home.statRow'
  | 'home.salaryBenchmark'
  | 'home.popularTech'
  | 'home.highSalaryTech.year'
  | 'home.highSalaryTech.month'
  | 'home.hotCombos'
  | 'techs.ranking'
  | 'techs.combos'
  | 'company.list'
  | 'job.list'
  | 'job.salary';

// Methodology 頁四大主題段落的錨點 id
export type SectionAnchor =
  | 'data-crawler'
  | 'database'
  | 'web-tech'
  | 'cloud-performance';

export interface MetricExplanation {
  readonly key: MetricKey;
  readonly title: string; // 此區塊的人類可讀名稱
  readonly source: string; // 資料來源（例：mv_salary_type_median_ratio）
  readonly scope: string; // 統計口徑 / 母體
  readonly formula: string; // 計算公式或方法
  readonly aggregation: string; // 聚合方式
  readonly updateFrequency: string; // 資料更新頻率（對應 refresh_mv_* 排程）
  readonly anchor: SectionAnchor; // 深連目標段落
}

export interface MethodologySection {
  readonly id: SectionAnchor;
  readonly title: string;
  readonly blocks: readonly MethodologyBlock[];
}

export type MethodologyBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | {
      readonly kind: 'list';
      readonly items: readonly string[];
    }
  | {
      readonly kind: 'table';
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    };
