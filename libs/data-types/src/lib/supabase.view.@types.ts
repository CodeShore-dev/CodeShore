import { SupabaseJobView } from './supabase.view.job.@types';
import { SupabaseLocationView } from './supabase.view.location.@types';
import { SupabaseSalaryView } from './supabase.view.salary.@types';
import { SupabaseTechView } from './supabase.view.tech.@types';

export { SupabaseJobView } from './supabase.view.job.@types';
export { SupabaseLocationView } from './supabase.view.location.@types';
export { SupabaseSalaryView } from './supabase.view.salary.@types';
export { SupabaseTechView } from './supabase.view.tech.@types';

/**
 * 物化視圖（materialized view）型別的彙整入口，保留扁平的 `SupabaseView.*`
 * 介面以維持向後相容。實際定義依關係拆分於各領域檔案：
 * - {@link SupabaseJobView}      工作 / 公司（supabase.view.job.@types）
 * - {@link SupabaseTechView}     技術（supabase.view.tech.@types）
 * - {@link SupabaseSalaryView}   薪資（supabase.view.salary.@types）
 * - {@link SupabaseLocationView} 地區（supabase.view.location.@types）
 */
export namespace SupabaseView {
  export type MvJob = SupabaseJobView.MvJob;
  export type MvCompany = SupabaseJobView.MvCompany;

  export type MvTech = SupabaseTechView.MvTech;
  export type MvTechCategory = SupabaseTechView.MvTechCategory;
  export type MvTechRanking = SupabaseTechView.MvTechRanking;
  export type MvTechTags = SupabaseTechView.MvTechTags;
  export type MvTechComboStats = SupabaseTechView.MvTechComboStats;

  export type MvSalaryTypeMedianRatio = SupabaseSalaryView.MvSalaryTypeMedianRatio;
  export type MvSalaryRangeMultiplier = SupabaseSalaryView.MvSalaryRangeMultiplier;

  export type MvLocationGroup = SupabaseLocationView.MvLocationGroup;
}
