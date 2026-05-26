export type JobOnAPI = {
  path: string;
  title: string;
  highlighted_title: string;
  description: string;
  highlighted_description: string;
  locations: string[];
  locations_with_locale: Record<string, string>[];
  salary: {
    min: string;
    max: string;
    currency: string;
    type: string;
  };
  seniority_level: string;
  job_type: string;
  inclusivity_traits: string[];
  number_of_management: string;
  number_of_openings: number;
  tags: string[];
  page: {
    path: string;
    name: string;
    highlighted_name: string;
    logo: string;
    country: string;
    geo: {
      region_l: string;
      city: string;
      state_name: string;
      zip: string;
      street_address: string;
    };
  };
  unique_impressions_count: number;
  lang_name: string;
  min_work_exp_year: number;
  content_updated_at: string;
};

export type JobsAPIResponse = {
  current_page: number;
  data: JobOnAPI[];
  total_entries: number;
  total_pages: number;
  per_page: number;
};

export type JobDetailOnHTML = {
  description: string;
  salary: string;
  company_type: string;
  location: string;
};
