export type MetricKey =
  | 'home.statRow'
  | 'home.salaryBenchmark'
  | 'home.salaryRangeMultiplier'
  | 'home.popularTech'
  | 'home.highSalaryTech.year'
  | 'home.highSalaryTech.month'
  | 'home.hotCombos'
  | 'techs.ranking'
  | 'techs.combos'
  | 'company.list'
  | 'job.list'
  | 'job.salary';

export type SectionAnchor =
  | 'data-crawler'
  | 'database'
  | 'web-tech'
  | 'cloud-performance';

export interface MetricItem {
  readonly name: string;
  readonly detail: string;
}

export interface MetricExplanation {
  readonly key: MetricKey;
  readonly title: string;
  readonly intro?: string;
  readonly items: readonly MetricItem[];
  readonly note?: string;
  readonly anchor: SectionAnchor;
  /**
   * 此 metric 背後直接讀取的資料庫物件名稱（view / materialized view /
   * function），對應 schema.sql 中的 CREATE 物件，用於顯示來源 SQL。
   */
  readonly sqlObjects: readonly string[];
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
