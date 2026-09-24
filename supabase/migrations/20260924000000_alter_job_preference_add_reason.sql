-- job-preference-reason-tag (task 1.1): adds a per-record sub-category
-- ("reason") to `job_preference`, plus the two RPCs that expose it.
--
-- Column: `reason text NOT NULL DEFAULT '未分類'`. Each preference record
-- carries exactly one reason (Requirement 1.1). New inserts that omit it get
-- the default (1.2), and `ADD COLUMN ... DEFAULT` back-fills every existing
-- row with '未分類' as part of this migration (1.3). Reasons are not a
-- separate table: the list of reasons for a user/preference is derived from
-- the rows themselves, so "like" and "dislike" lists stay independent (1.4).
--
-- Name rule: CHECK `reason = btrim(reason) AND char_length(reason) BETWEEN 1
-- AND 20`. The application trims before writing; the constraint rejects any
-- value that still has leading/trailing whitespace, is empty, or exceeds 20
-- characters. `char_length` counts code points, matching the shared-utils
-- rule. The default name '未分類' and the 20-char limit MUST stay in sync with
-- `preference-reason.ts` (see design.md "Revalidation Triggers").
--
-- Index `ix_job_preference_user_id_preference_reason` serves both the
-- reason-count RPC (GROUP BY reason within user + preference) and the
-- bulk "reset this reason to default" update.
--
-- `get_jobs_by_preference`: its RETURNS TABLE signature changes, which
-- `CREATE OR REPLACE` cannot do, so it is dropped and recreated.
-- `preference_reason` is appended as the LAST column, after
-- `preference_updated_at`, so every existing column (the `j.*` expansion of
-- mv_job, currently ending in `crawled_at`) keeps its position (7.2).
-- DROP/CREATE resets the ACL, so EXECUTE is re-granted to the same roles as
-- the other mv_job RPCs (`20260917000000_mv_salary_range_multiplier_use_median.sql`).
--
-- `get_job_preference_reason_counts`: lists every reason the user has at
-- least one record for under the given preference (3.1), even when all of
-- its jobs are closed (count 0). `job_count` only counts open jobs, using
-- the same `LEFT JOIN mv_job ... j.closed = false` rule as
-- `get_job_preference_count` (3.2); if that rule changes, this RPC must
-- change with it. SECURITY DEFINER to match `get_job_preference_count`, with
-- `SET search_path TO 'public'` per the convention established in
-- `20260723102035_fix_refresh_mv_location_tech_search_path.sql` (avoids the
-- "Function Search Path Mutable" advisory).
--
-- Rollback: drop `get_job_preference_reason_counts`, recreate
-- `get_jobs_by_preference` from `20260804000000_alter_mv_job_add_crawled_at.sql`,
-- then `ALTER TABLE public.job_preference DROP COLUMN reason` (reason data is
-- lost; preference data is unaffected).

BEGIN;

-- ── 1. Column + name rule ─────────────────────────────────────────────────
ALTER TABLE public."job_preference"
  ADD COLUMN "reason" text NOT NULL DEFAULT '未分類'::text;

ALTER TABLE public."job_preference"
  ADD CONSTRAINT "job_preference_reason_check"
  CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 20);

-- ── 2. Index ──────────────────────────────────────────────────────────────
CREATE INDEX ix_job_preference_user_id_preference_reason
  ON public.job_preference USING btree (user_id, preference, reason);

-- ── 3. get_jobs_by_preference (append preference_reason) ──────────────────
DROP FUNCTION IF EXISTS public.get_jobs_by_preference(uuid, text);

CREATE OR REPLACE FUNCTION public.get_jobs_by_preference(p_user_id uuid, p_preference text)
 RETURNS TABLE(id text, title text, location text, detail_link text, salary text, salary_type text, min_salary integer, max_salary integer, avg_salary numeric, created_at timestamp with time zone, updated_at timestamp with time zone, description text, company_id text, company_name text, company_link text, company_type text, techs text[], tech_mappings text[], closed boolean, description_ch_en_ratio numeric, keyword_groups jsonb, crawled_at timestamp with time zone, preference_updated_at timestamp with time zone, preference_reason text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT j.*, jp.updated_at AS preference_updated_at, jp.reason AS preference_reason
  FROM mv_job j
  JOIN job_preference jp
    ON jp.job_id = j.id
   AND jp.user_id = p_user_id
   AND jp.preference = p_preference;
$function$;

GRANT EXECUTE ON FUNCTION public.get_jobs_by_preference(uuid, text) TO anon, authenticated, service_role;

-- ── 4. get_job_preference_reason_counts (new) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_job_preference_reason_counts(p_user_id uuid, p_preference text)
 RETURNS TABLE(reason text, job_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jp.reason, COUNT(*) FILTER (WHERE j.closed = false) AS job_count
  FROM job_preference jp
  LEFT JOIN mv_job j ON j.id = jp.job_id
  WHERE jp.user_id = p_user_id
    AND jp.preference = p_preference
  GROUP BY jp.reason;
$function$;

-- SECURITY DEFINER + a caller-supplied p_user_id: only the backend (service
-- role) may call it, otherwise any PostgREST caller could read another
-- user's reason names and counts. Supabase's default privileges grant new
-- public functions to anon/authenticated, so revoke explicitly.
REVOKE ALL ON FUNCTION public.get_job_preference_reason_counts(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_preference_reason_counts(uuid, text) TO service_role;

COMMIT;
