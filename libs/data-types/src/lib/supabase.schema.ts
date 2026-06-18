export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      company: {
        Row: {
          created_at: string
          id: string
          link: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          link: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      job: {
        Row: {
          closed: boolean
          company_id: string
          created_at: string
          description: string
          detail_link: string
          id: string
          location: string
          max_salary: number
          min_salary: number
          salary: string
          salary_manual: boolean
          salary_type: string
          title: string
          updated_at: string
        }
        Insert: {
          closed?: boolean
          company_id: string
          created_at?: string
          description: string
          detail_link: string
          id: string
          location: string
          max_salary: number
          min_salary: number
          salary: string
          salary_manual?: boolean
          salary_type: string
          title: string
          updated_at?: string
        }
        Update: {
          closed?: boolean
          company_id?: string
          created_at?: string
          description?: string
          detail_link?: string
          id?: string
          location?: string
          max_salary?: number
          min_salary?: number
          salary?: string
          salary_manual?: boolean
          salary_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_job"
            referencedColumns: ["company_id"]
          },
        ]
      }
      job_description_bin: {
        Row: {
          content: string
          id: string
        }
        Insert: {
          content: string
          id?: string
        }
        Update: {
          content?: string
          id?: string
        }
        Relationships: []
      }
      job_keyword: {
        Row: {
          description_ch_en_ratio: number
          id: string
          keywords: string[]
        }
        Insert: {
          description_ch_en_ratio: number
          id: string
          keywords: string[]
        }
        Update: {
          description_ch_en_ratio?: number
          id?: string
          keywords?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "job_keyword_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "job"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_keyword_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "mv_job"
            referencedColumns: ["id"]
          },
        ]
      }
      job_keyword_group: {
        Row: {
          job_id: string
          keyword_group: string
          keywords: string
        }
        Insert: {
          job_id: string
          keyword_group: string
          keywords: string
        }
        Update: {
          job_id?: string
          keyword_group?: string
          keywords?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_join_keyword_group_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_join_keyword_group_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "mv_job"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_join_keyword_group_keyword_group_fkey"
            columns: ["keyword_group"]
            isOneToOne: false
            referencedRelation: "keyword_group"
            referencedColumns: ["id"]
          },
        ]
      }
      job_preference: {
        Row: {
          job_id: string
          preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          job_id: string
          preference: string
          updated_at?: string
          user_id: string
        }
        Update: {
          job_id?: string
          preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_preference_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_preference_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "mv_job"
            referencedColumns: ["id"]
          },
        ]
      }
      job_source: {
        Row: {
          url: string
        }
        Insert: {
          url: string
        }
        Update: {
          url?: string
        }
        Relationships: []
      }
      job_source_url: {
        Row: {
          page_index: number
          status: string
          url: string
        }
        Insert: {
          page_index?: number
          status: string
          url: string
        }
        Update: {
          page_index?: number
          status?: string
          url?: string
        }
        Relationships: []
      }
      keyword: {
        Row: {
          count: number
          id: string
        }
        Insert: {
          count: number
          id: string
        }
        Update: {
          count?: number
          id?: string
        }
        Relationships: []
      }
      keyword_bin: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      keyword_group: {
        Row: {
          category: string
          icon_slugs: string[] | null
          id: string
          label: string
          tags: string[] | null
        }
        Insert: {
          category: string
          icon_slugs?: string[] | null
          id: string
          label: string
          tags?: string[] | null
        }
        Update: {
          category?: string
          icon_slugs?: string[] | null
          id?: string
          label?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      keyword_group_keyword: {
        Row: {
          keyword: string
          keyword_group: string
        }
        Insert: {
          keyword: string
          keyword_group: string
        }
        Update: {
          keyword?: string
          keyword_group?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_group_join_keyword_keyword_group_fkey"
            columns: ["keyword_group"]
            isOneToOne: false
            referencedRelation: "keyword_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_group_keyword_mapping_keyword_fkey"
            columns: ["keyword"]
            isOneToOne: false
            referencedRelation: "keyword"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_group_parent: {
        Row: {
          child: string
          parent: string
        }
        Insert: {
          child: string
          parent: string
        }
        Update: {
          child?: string
          parent?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_group_parent_child_fkey"
            columns: ["child"]
            isOneToOne: false
            referencedRelation: "keyword_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_group_parent_parent_fkey"
            columns: ["parent"]
            isOneToOne: false
            referencedRelation: "keyword_group"
            referencedColumns: ["id"]
          },
        ]
      }
      location_group: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      location_group_location: {
        Row: {
          location: string
          location_group: string
        }
        Insert: {
          location: string
          location_group: string
        }
        Update: {
          location?: string
          location_group?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_group_location_location_group_fkey"
            columns: ["location_group"]
            isOneToOne: false
            referencedRelation: "location_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_group_location_location_group_fkey"
            columns: ["location_group"]
            isOneToOne: false
            referencedRelation: "mv_location_group"
            referencedColumns: ["location"]
          },
        ]
      }
    }
    Views: {
      mv_company: {
        Row: {
          company_id: string | null
          company_link: string | null
          company_name: string | null
          company_type: string | null
          job_count: number | null
          keyword_groups: string[] | null
        }
        Relationships: []
      }
      mv_job: {
        Row: {
          avg_salary: number | null
          closed: boolean | null
          company_id: string | null
          company_link: string | null
          company_name: string | null
          company_type: string | null
          created_at: string | null
          description: string | null
          description_ch_en_ratio: number | null
          detail_link: string | null
          id: string | null
          keyword_group_mappings: string[] | null
          keyword_groups: string[] | null
          location: string | null
          max_salary: number | null
          min_salary: number | null
          salary: string | null
          salary_type: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      mv_keyword_group: {
        Row: {
          category: string | null
          children: string[] | null
          count: number | null
          icon_slugs: string[] | null
          keyword_group: string | null
          keywords: string[] | null
          label: string | null
          parents: string[] | null
          tags: string[] | null
        }
        Relationships: []
      }
      mv_keyword_group_category: {
        Row: {
          category: string | null
          count: number | null
        }
        Relationships: []
      }
      mv_keyword_group_ranking: {
        Row: {
          category: string | null
          icon_slugs: string[] | null
          job_count: number | null
          keyword_group: string | null
          label: string | null
          month_median_avg: number | null
          month_pr75_avg: number | null
          month_pr88_avg: number | null
          tags: string[] | null
          year_median_avg: number | null
          year_pr75_avg: number | null
          year_pr88_avg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_join_keyword_group_keyword_group_fkey"
            columns: ["keyword_group"]
            isOneToOne: false
            referencedRelation: "keyword_group"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_keyword_group_tags: {
        Row: {
          category: string | null
          count: number | null
          tag: string | null
        }
        Relationships: []
      }
      mv_location_group: {
        Row: {
          count: number | null
          location: string | null
        }
        Relationships: []
      }
      mv_salary_type_median_ratio: {
        Row: {
          high_mark: number | null
          median_mark: number | null
          salary_type: string | null
          top_mark: number | null
        }
        Relationships: []
      }
      mv_salary_weighted_ratio: {
        Row: {
          ratio: number | null
          salary_type: string | null
        }
        Relationships: []
      }
      mv_tech_combo_stats: {
        Row: {
          cat1: string | null
          cat2: string | null
          job_count: number | null
          median_max_month: number | null
          median_max_year: number | null
          median_min_month: number | null
          median_min_year: number | null
          month_median_avg: number | null
          month_pr75_avg: number | null
          month_pr88_avg: number | null
          pr75_max_month: number | null
          pr75_max_year: number | null
          pr75_min_month: number | null
          pr75_min_year: number | null
          pr88_max_month: number | null
          pr88_max_year: number | null
          pr88_min_month: number | null
          pr88_min_year: number | null
          tech1: string | null
          tech1_icons: string[] | null
          tech1_label: string | null
          tech1_tags: string[] | null
          tech2: string | null
          tech2_icons: string[] | null
          tech2_label: string | null
          tech2_tags: string[] | null
          year_median_avg: number | null
          year_pr75_avg: number | null
          year_pr88_avg: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_job_count: {
        Args: never
        Returns: {
          jobs: number
          month_salary_type_jobs: number
          open_jobs: number
          year_salary_type_jobs: number
        }[]
      }
      get_job_crawl_stats: {
        Args: { p_days?: number }
        Returns: {
          new_jobs_count: number
          new_jobs_date: string
          updated_jobs_count: number
          updated_jobs_date: string
        }[]
      }
      get_job_preference_count: { Args: { p_user_id: string }; Returns: Json }
      get_job_update_date_counts: {
        Args: never
        Returns: {
          count: number
          updated_date: string
        }[]
      }
      get_jobs_by_preference: {
        Args: { p_preference: string; p_user_id: string }
        Returns: {
          avg_salary: number
          closed: boolean
          company_id: string
          company_link: string
          company_name: string
          company_type: string
          created_at: string
          description: string
          description_ch_en_ratio: number
          detail_link: string
          id: string
          keyword_group_mappings: string[]
          keyword_groups: string[]
          location: string
          max_salary: number
          min_salary: number
          preference_updated_at: string
          salary: string
          salary_type: string
          title: string
          updated_at: string
        }[]
      }
      get_location_anomaly_jobs: {
        Args: { p_maxlen?: number; p_type: string }
        Returns: {
          closed: boolean
          company_id: string
          created_at: string
          description: string
          detail_link: string
          id: string
          location: string
          max_salary: number
          min_salary: number
          salary: string
          salary_manual: boolean
          salary_type: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "job"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_tech_combo_stats: {
        Args: { p_limit?: number }
        Returns: {
          avg_max_month: number
          avg_max_year: number
          avg_min_month: number
          avg_min_year: number
          cat1: string
          cat2: string
          job_count: number
          tech1: string
          tech1_label: string
          tech2: string
          tech2_label: string
        }[]
      }
      get_unreviewed_jobs: {
        Args: { p_user_id: string }
        Returns: {
          avg_salary: number | null
          closed: boolean | null
          company_id: string | null
          company_link: string | null
          company_name: string | null
          company_type: string | null
          created_at: string | null
          description: string | null
          description_ch_en_ratio: number | null
          detail_link: string | null
          id: string | null
          keyword_group_mappings: string[] | null
          keyword_groups: string[] | null
          location: string | null
          max_salary: number | null
          min_salary: number | null
          salary: string | null
          salary_type: string | null
          title: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_job"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_weighted_market_ratio: {
        Args: never
        Returns: {
          total_valid_samples: number
          weighted_market_ratio: number
        }[]
      }
      refresh_mv_company: { Args: never; Returns: undefined }
      refresh_mv_job: { Args: never; Returns: undefined }
      refresh_mv_keyword_group: { Args: never; Returns: undefined }
      refresh_mv_keyword_group_category: { Args: never; Returns: undefined }
      refresh_mv_keyword_group_ranking: { Args: never; Returns: undefined }
      refresh_mv_keyword_group_tags: { Args: never; Returns: undefined }
      refresh_mv_location_group: { Args: never; Returns: undefined }
      refresh_mv_salary_type_median_ratio: { Args: never; Returns: undefined }
      refresh_mv_salary_weighted_ratio: { Args: never; Returns: undefined }
      refresh_mv_tech_combo_stats: { Args: never; Returns: undefined }
      reset_keywords: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
