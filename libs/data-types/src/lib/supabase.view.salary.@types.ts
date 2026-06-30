import { Database } from './supabase.schema';
import { NonNull } from './utils.@types';

/**
 * 薪資領域的物化視圖。
 *
 * 由 job 的薪資資料彙總出各薪資類型（月薪 / 年薪）的中位數級距與
 * 薪資範圍倍率。
 */
export namespace SupabaseSalaryView {
  /**
   * job
   * mv_salary_type_median_ratio
   */
  export type MvSalaryTypeMedianRatio = NonNull<Database['public']['Views']['mv_salary_type_median_ratio']['Row']>;

  /**
   * job
   */
  export type MvSalaryRangeMultiplier = NonNull<Database['public']['Views']['mv_salary_range_multiplier']['Row']>;
}
