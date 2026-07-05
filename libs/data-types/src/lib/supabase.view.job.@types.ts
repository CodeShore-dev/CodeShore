import { Database } from './supabase.schema';
import { Modify, NonNull } from './utils.@types';

/**
 * 工作 / 公司領域的物化視圖。
 *
 * 以 job 為核心，串接 company、job_tech 等關聯，提供職缺列表與
 * 公司彙總所需的資料。
 */
export namespace SupabaseJobView {
  /**
   * job
   * job_keyword
   * company
   * job_tech
   * location_group
   * location_group_location
   */
  export type MvJob = Modify<
    NonNull<Database['public']['Views']['mv_job']['Row']>,
    {
      updated_at: Date;
      created_at: Date;
      /**
       * Only present when rows come from get_jobs_by_preference
       * (the liked / disliked lists); reflects when the current
       * user marked the job.
       */
      preference_updated_at?: Date;
    }
  >;

  /**
   * company
   * job
   * job_tech
   */
  export type MvCompany = NonNull<Database['public']['Views']['mv_company']['Row']>;

  /**
   * company
   * job
   * job_tech
   * tech
   */
  export type MvCompanyTech = NonNull<Database['public']['Views']['mv_company_tech']['Row']>;
}
