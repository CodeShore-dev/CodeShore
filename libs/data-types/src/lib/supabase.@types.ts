import { Database } from './supabase.schema';
import { Modify } from './utils.@types';

// `ai_suggestion` 佇列表的欄位型別（見 ai-database-maintenance-workflow spec
// design.md「Logical Data Model：ai_suggestion」）。這些型別名稱刻意不放進
// `SupabaseTable` 命名空間，讓後續任務（backend AiSuggestionService 契約、
// 5 個 generator）可直接沿用同一組型別名稱，不必另外命名。
export type AiSuggestionTargetTable =
  | 'job_description_bin'
  | 'tech'
  | 'keyword_bin'
  | 'tech_keyword'
  | 'tech_parent'
  | 'location_group'
  | 'location_group_location';

export type AiSuggestionWorkflow =
  | 'keyword_mapping'
  | 'tech_dictionary'
  | 'tech_hierarchy'
  | 'location_mapping'
  | 'noise_detection';

export type AiSuggestionAction = 'insert' | 'update' | 'delete';
export type AiSuggestionStatus = 'pending' | 'approved' | 'rejected';

export namespace SupabaseTable {
  // 對應新的 supabase/migrations/*_create_ai_llm_setting.sql（在已完成的
  // ai-database-maintenance-workflow spec 之上，為 OpenRouter LLM 供應商切換
  // 追加的簡易 key-value 設定表）。該遷移同樣尚未套用到實際 Supabase 專案
  // （sandbox 無 Docker／遠端憑證），套用後需重跑 `pnpm db:sync` 重新產生
  // supabase.schema.ts，屆時應核對此手動型別與產生器輸出是否一致並視需要調整。
  export type AiLlmSetting = Database['public']['Tables']['ai_llm_setting']['Row'];

  // 對應新的 supabase/migrations/20260707000000_create_ai_suggestion.sql；
  // 該遷移尚未套用到實際 Supabase 專案（sandbox 無 Docker／遠端憑證），套用後
  // 需重跑 `pnpm db:sync` 重新產生 supabase.schema.ts，屆時應核對此手動型別
  // 與產生器輸出是否一致並視需要調整。
  export type AiSuggestion = Modify<
    Database['public']['Tables']['ai_suggestion']['Row'],
    {
      target_table: AiSuggestionTargetTable;
      workflow: AiSuggestionWorkflow;
      action: AiSuggestionAction;
      status: AiSuggestionStatus;
      target_key: Readonly<Record<string, string>>;
      payload: Record<string, unknown>;
      evidence: Record<string, unknown>;
      outcome: Record<string, unknown> | null;
    }
  >;

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

  // `ai-database-maintenance-workflow` task 1.2: `tech_parent` already exists
  // as a table (see `supabase/schema.sql`) but, unlike `LocationGroup` /
  // `LocationGroup_.Location` below, had no `SupabaseTable.*` alias yet. This
  // mirrors the existing simple-alias pattern (e.g. `Tech`, `KeywordBin`)
  // rather than inventing a new naming scheme.
  export type TechParent = Database['public']['Tables']['tech_parent']['Row'];

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
