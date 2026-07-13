-- Creates the `job_description_line_keyword` table: per-line AI review record
-- pairing rule-based candidate keywords with the AI-reviewed final keyword
-- set (task 1.2 of the job-keyword-ai-review feature).
--
-- Source of truth for this DDL:
-- .kiro/specs/job-keyword-ai-review/design.md
--   -> "資料模型" -> "`job_description_line_keyword`"
-- .kiro/specs/job-keyword-ai-review/requirements.md
--   -> Requirement 3（3.4）, Requirement 4（4.2）
--
-- IMPORTANT: this is a reviewable, versioned artifact only. The sandbox this
-- migration was authored in has no live Supabase project available (no
-- Docker daemon, no remote project credentials), so it has NOT been applied
-- anywhere. A human must apply it to the real Supabase project (e.g. via
-- `supabase db push` or the SQL editor) and then re-run
-- `scripts/sync-supabase-schema.mjs` (`pnpm db:sync`) so that
-- `supabase/schema.sql` and the generated types in `libs/data-types`
-- reflect the live database.

CREATE TABLE public."job_description_line_keyword" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "line_id" uuid NOT NULL,
  "rule_keywords" text[] NOT NULL,
  "ai_status" text NOT NULL,
  "ai_is_correct" boolean,
  "final_keywords" text[] NOT NULL,
  "reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============ Constraints ============
ALTER TABLE public."job_description_line_keyword" ADD CONSTRAINT "job_description_line_keyword_pkey" PRIMARY KEY (id);

ALTER TABLE public."job_description_line_keyword" ADD CONSTRAINT "job_description_line_keyword_line_id_fkey" FOREIGN KEY (line_id) REFERENCES public.job_description_line(id) ON DELETE CASCADE;

-- 一行一筆覆核紀錄（design.md「資料模型」：`line_id` FK ... 唯一）。
ALTER TABLE public."job_description_line_keyword" ADD CONSTRAINT "job_description_line_keyword_line_id_key" UNIQUE (line_id);

-- Requirement 4.2：AI 覆核呼叫失敗時需記錄該行覆核失敗的狀態，供後續追蹤；
-- 成功時記為 'ok'（見 design.md 錯誤處理表）。
ALTER TABLE public."job_description_line_keyword" ADD CONSTRAINT "job_description_line_keyword_ai_status_check" CHECK (
  ai_status IN ('ok', 'failed')
);

-- ============ Indexes ============
-- `line_id` 上的唯一約束已隱含建立索引，供依 line_id 查詢單行覆核紀錄。
