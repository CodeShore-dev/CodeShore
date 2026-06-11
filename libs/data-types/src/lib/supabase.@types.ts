import { Database } from './supabase.schema';
import { Modify, NonNull } from './utils.@types';

export namespace SupabaseTable {
  export type Job = Modify<
    Database['public']['Tables']['job']['Row'],
    {
      updated_at?: Date;
      created_at?: Date;
    }
  >;

  export namespace Job_ {
    export type Keyword =
      Database['public']['Tables']['job_keyword']['Row'];
    export type KeywordGroup =
      Database['public']['Tables']['job_keyword_group']['Row'];
  }

  export type Company = Modify<
    Database['public']['Tables']['company']['Row'],
    {
      created_at?: Date;
    }
  >;

  export type JobDescriptionBin =
    Database['public']['Tables']['job_description_bin']['Row'];

  export type JobPreference = Modify<
    Database['public']['Tables']['job_preference']['Row'],
    {
      updated_at?: Date;
    }
  >;

  export type Keyword =
    Database['public']['Tables']['keyword']['Row'];

  export type KeywordBin =
    Database['public']['Tables']['keyword_bin']['Row'];

  export type KeywordGroup =
    Database['public']['Tables']['keyword_group']['Row'];

  export namespace KeywordGroup_ {
    export type Keyword =
      Database['public']['Tables']['keyword_group_keyword']['Row'];
  }

  export type JobSource =
    Database['public']['Tables']['job_source']['Row'];

  export type JobSourceURL =
    Database['public']['Tables']['job_source_url']['Row'];

  export type LocationGroup =
    Database['public']['Tables']['location_group']['Row'];

  export namespace LocationGroup_ {
    export type Location =
      Database['public']['Tables']['location_group_location']['Row'];
  }
}

export namespace SupabaseFunction {
  export type JobCount = {
    jobs: number;
    open_jobs: number;
    month_salary_type_jobs: number;
    year_salary_type_jobs: number;
  };

  export type JobPreferenceCount = {
    liked_count: number;
    disliked_count: number;
  };
}

export namespace SupabaseView {
  /**
   * company
   * job
   * job_keyword_group
   */
  export type MvCompany = NonNull<
    Database['public']['Views']['mv_company']['Row']
  >;

  /**
   * job
   * job_keyword
   * company
   * job_keyword_group
   * location_group
   * location_group_location
   */
  export type MvJob = Modify<
    NonNull<Database['public']['Views']['mv_job']['Row']>,
    {
      updated_at: Date;
      created_at: Date;
    }
  >;

  /**
   * keyword
   * keyword_group_keyword
   * keyword_group_parent
   * keyword_group
   * keyword_bin
   */
  export type MvKeywordGroup = NonNull<
    Database['public']['Views']['mv_keyword_group']['Row']
  >;

  /**
   * keyword_group
   */
  export type MvKeywordGroupCategory = NonNull<
    Database['public']['Views']['mv_keyword_group_category']['Row']
  >;

  /**
   * job_keyword_group
   * job
   * keyword_group
   */
  export type MvKeywordGroupRanking = NonNull<
    Database['public']['Views']['mv_keyword_group_ranking']['Row']
  >;

  /**
   * keyword_group
   */
  export type MvKeywordGroupTags = NonNull<
    Database['public']['Views']['mv_keyword_group_tags']['Row']
  >;

  /**
   * job_keyword_group
   * job
   * keyword_group
   * mv_keyword_group
   */
  export type MvTechComboStats = NonNull<
    Database['public']['Views']['mv_tech_combo_stats']['Row']
  >;

  /**
   * job
   * location_group_location
   * location_group
   */
  export type MvLocationGroup = NonNull<
    Database['public']['Views']['mv_location_group']['Row']
  >;

  /**
   * job
   * mv_salary_type_median_ratio
   */
  export type MvSalaryTypeMedianRatio = NonNull<
    Database['public']['Views']['mv_salary_type_median_ratio']['Row']
  >;

  /**
   * job
   */
  export type MvSalaryWeightedRatio = NonNull<
    Database['public']['Views']['mv_salary_weighted_ratio']['Row']
  >;
}
