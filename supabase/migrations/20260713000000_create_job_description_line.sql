-- Creates the `job_description_line` table: per-job, per-line expansion of
-- `job.description` (task 1.1 of the job-keyword-ai-review feature).
--
-- Source of truth for this DDL:
-- .kiro/specs/job-keyword-ai-review/design.md
--   -> "資料模型" -> "`job_description_line`"
-- .kiro/specs/job-keyword-ai-review/requirements.md
--   -> Requirement 1（1.1-1.4）
--
-- Applied to the live Supabase project (lsizfvkzpwxkwvohrkmn) via the
-- Supabase MCP `apply_migration` tool; `pnpm db:sync` has been re-run so
-- `supabase/schema.sql` and `libs/data-types` reflect the live database.
-- RLS was enabled after this migration landed — see
-- `20260713020000_enable_rls_job_description_line_tables.sql`.

CREATE TABLE public."job_description_line" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "job_id" text NOT NULL,
  "line_no" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============ Constraints ============
ALTER TABLE public."job_description_line" ADD CONSTRAINT "job_description_line_pkey" PRIMARY KEY (id);

ALTER TABLE public."job_description_line" ADD CONSTRAINT "job_description_line_job_id_fkey" FOREIGN KEY (job_id) REFERENCES public.job(id) ON DELETE CASCADE;

-- Requirement 1.4: 批次重跑以 reset()（deleteAll + insert）整批取代同一 job
-- 先前產生的逐行紀錄，此唯一約束確保單一批次寫入內不會為同一 job 產生重複行序。
ALTER TABLE public."job_description_line" ADD CONSTRAINT "job_description_line_job_id_line_no_key" UNIQUE (job_id, line_no);

-- ============ Indexes ============
-- 逐行紀錄以 job_id 查詢回溯原始職缺（1.2）；唯一約束已隱含建立
-- (job_id, line_no) 複合索引，這裡另外建立單欄索引以支援純 job_id 查詢。
CREATE INDEX "ix_job_description_line_job_id" ON public."job_description_line" USING btree (job_id);
