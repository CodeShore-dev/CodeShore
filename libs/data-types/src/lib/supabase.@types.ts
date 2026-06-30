import { Database } from './supabase.schema';
import { Modify } from './utils.@types';

export namespace SupabaseTable {
  export type Job = Modify<
    Database['public']['Tables']['job']['Row'],
    {
      updated_at?: Date;
      created_at?: Date;
      salary_manual?: boolean;
    }
  >;

  export namespace Job_ {
    export type Keyword = Database['public']['Tables']['job_keyword']['Row'];
    export type Tech = Database['public']['Tables']['job_tech']['Row'];
  }

  export type Company = Modify<
    Database['public']['Tables']['company']['Row'],
    {
      created_at?: Date;
    }
  >;

  export type JobDescriptionBin = Database['public']['Tables']['job_description_bin']['Row'];

  export type JobPreference = Modify<
    Database['public']['Tables']['job_preference']['Row'],
    {
      updated_at?: Date;
    }
  >;

  export type Keyword = Database['public']['Tables']['keyword']['Row'];

  export type KeywordBin = Database['public']['Tables']['keyword_bin']['Row'];

  export type Tech = Database['public']['Tables']['tech']['Row'];

  export namespace Tech_ {
    export type Keyword = Database['public']['Tables']['tech_keyword']['Row'];
  }

  export type JobSource = Database['public']['Tables']['job_source']['Row'];

  export type JobSourceURL = Database['public']['Tables']['job_source_url']['Row'];

  export type LocationGroup = Database['public']['Tables']['location_group']['Row'];

  export namespace LocationGroup_ {
    export type Location = Database['public']['Tables']['location_group_location']['Row'];
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

  export type JobCrawlStats = Database['public']['Functions']['get_job_crawl_stats']['Returns'][number];

  export type LocationAnomalyJob = Database['public']['Functions']['get_location_anomaly_jobs']['Returns'][number];

  export type JobUpdateDateCount = Database['public']['Functions']['get_job_update_date_counts']['Returns'][number];

  export type JobHostStatistic = Database['public']['Functions']['get_job_host_statistics']['Returns'][number];
}
