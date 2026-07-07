-- Creates the `ai_suggestion` table: the unified pending-review queue for
-- the AI database maintenance workflow feature (task 1.1).
--
-- Source of truth for this DDL:
-- .kiro/specs/ai-database-maintenance-workflow/design.md
--   -> "Data Models" -> "Logical Data Model：`ai_suggestion`"
-- .kiro/specs/ai-database-maintenance-workflow/requirements.md
--   -> Requirement 1 (1.1-1.5), Requirement 9 (9.1)
--
-- IMPORTANT: this is a reviewable, versioned artifact only. The sandbox this
-- migration was authored in has no live Supabase project available (no
-- Docker daemon, no remote project credentials), so it has NOT been applied
-- anywhere. A human must apply it to the real Supabase project (e.g. via
-- `supabase db push` or the SQL editor) and then re-run
-- `scripts/sync-supabase-schema.mjs` (`pnpm db:sync`) so that
-- `supabase/schema.sql` and the generated types in `libs/data-types`
-- reflect the live database.

CREATE TABLE public."ai_suggestion" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "target_table" text NOT NULL,
  "workflow" text NOT NULL,
  "action" text NOT NULL,
  "target_key" jsonb NOT NULL,
  "payload" jsonb NOT NULL,
  "evidence" jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "flagged_for_review" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "resolution_note" text,
  "outcome" jsonb
);

-- ============ Constraints ============
ALTER TABLE public."ai_suggestion" ADD CONSTRAINT "ai_suggestion_pkey" PRIMARY KEY (id);

ALTER TABLE public."ai_suggestion" ADD CONSTRAINT "ai_suggestion_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);

-- Requirement 1.1:每筆建議需標明目標資料表，且僅限這 7 張 [AI] 標記表之一。
ALTER TABLE public."ai_suggestion" ADD CONSTRAINT "ai_suggestion_target_table_check" CHECK (
  target_table IN (
    'job_description_bin',
    'tech',
    'keyword_bin',
    'tech_keyword',
    'tech_parent',
    'location_group',
    'location_group_location'
  )
);

-- 對應 design.md 的 5 個子工作流識別碼。
ALTER TABLE public."ai_suggestion" ADD CONSTRAINT "ai_suggestion_workflow_check" CHECK (
  workflow IN (
    'keyword_mapping',
    'tech_dictionary',
    'tech_hierarchy',
    'location_mapping',
    'noise_detection'
  )
);

ALTER TABLE public."ai_suggestion" ADD CONSTRAINT "ai_suggestion_action_check" CHECK (
  action IN ('insert', 'update', 'delete')
);

-- Requirement 1.1 / 1.5: 三種狀態的生命週期。
ALTER TABLE public."ai_suggestion" ADD CONSTRAINT "ai_suggestion_status_check" CHECK (
  status IN ('pending', 'approved', 'rejected')
);

-- ============ Indexes ============
-- Requirement 1.4: 同一目標資料且欄位組合已存在一筆 pending 建議時，避免重複建立。
-- 以 partial unique index 在資料層本身拒絕第二筆相同的待審建議，任務 1.1 的
-- 「可觀察完成狀態」要求重覆寫入同一目標時第二次寫入失敗或被拒絕。
CREATE UNIQUE INDEX "ux_ai_suggestion_pending_target" ON public."ai_suggestion" USING btree (target_table, workflow, target_key) WHERE (status = 'pending');

CREATE INDEX "ix_ai_suggestion_target_table_status" ON public."ai_suggestion" USING btree (target_table, status);
