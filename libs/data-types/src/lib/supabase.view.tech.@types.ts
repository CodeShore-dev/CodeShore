import { Database } from './supabase.schema';
import { NonNull } from './utils.@types';

/**
 * 技術領域的物化視圖。
 *
 * 以 tech / keyword 為核心，提供技術彙總、分類、排名、標籤與
 * 技術組合（combo）薪資統計等資料。
 */
export namespace SupabaseTechView {
  /**
   * keyword
   * tech_keyword
   * tech_parent
   * tech
   * keyword_bin
   */
  export type MvTech = NonNull<Database['public']['Views']['mv_tech']['Row']>;

  /**
   * tech
   */
  export type MvTechCategory = NonNull<Database['public']['Views']['mv_tech_category']['Row']>;

  /**
   * job_tech
   * job
   * tech
   */
  export type MvTechRanking = NonNull<Database['public']['Views']['mv_tech_ranking']['Row']>;

  /**
   * tech
   */
  export type MvTechTags = NonNull<Database['public']['Views']['mv_tech_tags']['Row']>;

  /**
   * job_tech
   * job
   * tech
   * mv_tech
   */
  export type MvTechComboStats = NonNull<Database['public']['Views']['mv_tech_combo_stats']['Row']>;
}
