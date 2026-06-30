import { Database } from './supabase.schema';
import { NonNull } from './utils.@types';

/**
 * 地區領域的物化視圖。
 *
 * 由 job 串接 location_group / location_group_location，彙總各地區
 * 群組的職缺數量。
 */
export namespace SupabaseLocationView {
  /**
   * job
   * location_group_location
   * location_group
   */
  export type MvLocationGroup = NonNull<Database['public']['Views']['mv_location_group']['Row']>;
}
