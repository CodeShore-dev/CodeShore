-- Creates the `job_filter_subscription` table: per-user "followed filter
-- combination" records for the job-filter-watchlist feature (task 1.2).
--
-- Source of truth for this DDL:
-- .kiro/specs/job-filter-watchlist/design.md
--   -> "File Structure Plan" (migration row)
--   -> "Components & Interfaces" -> `JobFilterSubscriptionService`
-- .kiro/specs/job-filter-watchlist/research.md
--   -> "2.1 篩選條件的正規化與儲存格式"
--
-- Two separate jsonb columns are intentional (see research.md 2.1):
--   - `filter_snapshot`: the normalized, structured `JobFilterSnapshot`
--     (see `libs/shared-utils/src/lib/job-filter-snapshot.ts`,
--     `normalizeFilterSnapshot()`). Used for the duplicate-follow check and
--     the `(user_id, filter_snapshot)` uniqueness constraint below.
--   - `filter_where`: the opaque PostgREST `where` object already produced
--     by the frontend's `deriveJobWhere()` at follow time. Stored and reused
--     verbatim by the backend's count queries (via the existing generic
--     where+count query mechanism / `MvJobService`); never compared or
--     indexed.
--
-- IMPORTANT: this is a reviewable, versioned artifact only. The sandbox this
-- migration was authored in has no live Supabase project available (no
-- Supabase CLI installed, no Docker daemon, no remote project credentials),
-- so it has NOT been applied anywhere. A human must apply it to the real
-- Supabase project (e.g. via `supabase db push` or the SQL editor) and then
-- re-run `scripts/sync-supabase-schema.mjs` (`pnpm db:sync`) so that
-- `supabase/schema.sql` and the generated types in `libs/data-types` reflect
-- the live database (the hand-authored types added alongside this migration
-- in `libs/data-types/src/lib/supabase.schema.ts` /
-- `libs/data-types/src/lib/supabase.@types.ts` should then be reconciled
-- against the generator's actual output).

CREATE TABLE public."job_filter_subscription" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "filter_snapshot" jsonb NOT NULL,
  "filter_where" jsonb NOT NULL,
  "label" text NOT NULL,
  "last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============ Constraints ============
ALTER TABLE public."job_filter_subscription" ADD CONSTRAINT "job_filter_subscription_pkey" PRIMARY KEY (id);

ALTER TABLE public."job_filter_subscription" ADD CONSTRAINT "job_filter_subscription_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- ============ Indexes ============
-- Requirement 1 AC3 (design.md "File Structure Plan" migration row):
-- one user cannot follow the same normalized filter combination twice.
-- Application-layer dedup (`findByUserAndSnapshot` + service-level check
-- before insert) is the primary guard; this unique index is the
-- database-layer backstop against concurrent-request races (see design.md
-- "job-filter-watchlist Service" -> 建立流程).
CREATE UNIQUE INDEX "ux_job_filter_subscription_user_snapshot" ON public."job_filter_subscription" USING btree (user_id, filter_snapshot);

-- ============ Row Level Security ============
-- Project convention (confirmed live against the Supabase project during
-- task 1.2 review, not documented in any migration file): every public
-- table gets RLS enabled with zero policies. This fully blocks the
-- anon/authenticated PostgREST public API from reading or writing this
-- table; the backend's SERVICE ROLE client (which bypasses RLS entirely)
-- is the only intended reader/writer, and it does its own `user_id`
-- scoping in application code (see `JobFilterSubscriptionService`),
-- exactly like `job_preference`.
ALTER TABLE public."job_filter_subscription" ENABLE ROW LEVEL SECURITY;
