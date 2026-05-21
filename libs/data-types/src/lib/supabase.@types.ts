export namespace SupabaseTable {
  export type Job = {
    id: string;
    title: string;
    location: string;
    detail_link: string;
    salary: string;
    description: string;
    max_salary: number;
    min_salary: number;
    salary_type: string;
    created_at: Date | undefined;
    updated_at: Date | undefined;
    company_id: string;
    closed: boolean;
  };

  export type Company = {
    id: string;
    name: string;
    link: string;
    type: string;
    created_at: Date;
  };

  export type JobJoinKeywordGroup = {
    job_id: string;
    keyword_group: string;
    keywords: string;
  };

  export type JobPreference = {
    id: string;
    job_id: string;
    preference: string;
    updated_at: Date;
    user_id: string;
  };

  export type JobKeyword = {
    id: string;
    keywords: string[];
    description_ch_en_ratio: number;
    job?: Pick<SupabaseTable.Job, 'company_id' | 'closed'>;
  };

  export type Keyword = {
    id: string;
    count: number;
  };

  export type KeywordGroup = {
    id: string;
    category?: string;
    parent?: string;
  };

  export type KeywordGroupJoinKeyword = {
    keyword_group: string;
    keyword: string;
  };
}

export namespace SupabaseFunction {
  export type SalaryRange = {
    avg_min_salary_month: number;
    avg_max_salary_month: number;
    avg_min_salary_year: number;
    avg_max_salary_year: number;
  };

  export type JobCount = {
    jobs: number;
    month_salary_type_jobs: number;
    year_salary_type_jobs: number;
  };

  export type TechStat = {
    keyword_group: string;
    category: string;
    job_count: number;
    avg_min_month: number | null;
    avg_max_month: number | null;
    avg_min_year: number | null;
    avg_max_year: number | null;
  };

  export type TechComboStat = {
    tech1: string;
    tech2: string;
    cat1: string;
    cat2: string;
    job_count: number;
    avg_min_month: number | null;
    avg_max_month: number | null;
    avg_min_year: number | null;
    avg_max_year: number | null;
  };

  export type SalaryStat = {
    salary_type: string;
    avg_mark: number;
    high_mark: number;
    top_mark: number;
  };

  export type JobPreferenceCount = {
    liked_count: number;
    disliked_count: number;
  };
}

export namespace SupabaseView {
  export type JobView = Pick<
    SupabaseTable.Job,
    | 'id'
    | 'title'
    | 'location'
    | 'detail_link'
    | 'salary'
    | 'salary_type'
    | 'min_salary'
    | 'max_salary'
    | 'created_at'
    | 'updated_at'
    | 'description'
    | 'company_id'
    | 'closed'
  > &
    Pick<
      SupabaseTable.JobKeyword,
      'description_ch_en_ratio'
    > & {
      company_name: string;
      company_link: string;
      company_type: string;
      job_preference_id: string;
      keyword_groups: string[];
      keyword_group_mappings: string[];
    };

  export type KeywordGroupView = {
    keyword_group: string;
    count: number;
    keywords: string[];
    category: string | null;
    parent: string | null;
  };

  export type KeywordGroupCategory = {
    category: string;
    count: number;
  };

  export type CompanyView = {
    company_id: string;
    company_name: string;
    company_link: string;
    company_type: string;
    job_count: number;
    keyword_groups: string[];
  };
}
