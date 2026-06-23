-- Forward migration: rename the `keyword_group` vocabulary to `tech`.
-- Spec: .kiro/specs/rename-keyword-group-to-tech (design.md Canonical Token Map A)
--
-- Pure rename: no data values change. `keyword` (raw keyword) is untouched.
-- Mechanics:
--   * Tables/columns/constraints/indexes/matview names + matview output columns
--     are renamed in place (ALTER ... RENAME) -- preserves data, indexes, grants,
--     RLS, and dependent view/matview definitions (PG updates them by OID).
--   * The 4 refresh_* functions are RENAMEd (preserves EXECUTE grants) then their
--     text bodies are rewritten to point at the renamed matviews.
--   * reset_keywords keeps its name (CREATE OR REPLACE) but its body references to
--     keyword_group_keyword and the hard-coded constraint name are updated.
--   * get_jobs_by_preference renames its RETURNS TABLE columns, which PostgreSQL
--     forbids via CREATE OR REPLACE, so it is DROPped + CREATEd and EXECUTE re-granted.
--
-- All DDL is transactional; applied as a single atomic unit.

BEGIN;

-- ============================================================
-- 1. Rename constraints (use current table names, before table rename)
-- ============================================================
ALTER TABLE public.keyword_group           RENAME CONSTRAINT pk_keyword_group TO pk_tech;
ALTER TABLE public.keyword_group_keyword   RENAME CONSTRAINT pk_keyword_group_keyword TO pk_tech_keyword;
ALTER TABLE public.keyword_group_keyword   RENAME CONSTRAINT keyword_group_join_keyword_keyword_group_fkey TO tech_keyword_join_tech_fkey;
ALTER TABLE public.keyword_group_keyword   RENAME CONSTRAINT keyword_group_keyword_mapping_keyword_fkey TO tech_keyword_mapping_keyword_fkey;
ALTER TABLE public.keyword_group_parent    RENAME CONSTRAINT keyword_group_parent_pkey TO tech_parent_pkey;
ALTER TABLE public.keyword_group_parent    RENAME CONSTRAINT keyword_group_parent_child_fkey TO tech_parent_child_fkey;
ALTER TABLE public.keyword_group_parent    RENAME CONSTRAINT keyword_group_parent_parent_fkey TO tech_parent_parent_fkey;
ALTER TABLE public.job_keyword_group       RENAME CONSTRAINT pk_job_keyword_group TO pk_job_tech;
ALTER TABLE public.job_keyword_group       RENAME CONSTRAINT job_join_keyword_group_job_id_fkey TO job_join_tech_job_id_fkey;
ALTER TABLE public.job_keyword_group       RENAME CONSTRAINT job_join_keyword_group_keyword_group_fkey TO job_join_tech_tech_fkey;

-- ============================================================
-- 2. Rename indexes (independent of table name)
-- ============================================================
ALTER INDEX public.ix_job_keyword_group_job_id          RENAME TO ix_job_tech_job_id;
ALTER INDEX public.ix_job_keyword_group_keyword_group   RENAME TO ix_job_tech_tech;
ALTER INDEX public.keyword_group_category_idx           RENAME TO tech_category_idx;
ALTER INDEX public.ix_keyword_group_keyword_keyword     RENAME TO ix_tech_keyword_keyword;
ALTER INDEX public.ix_keyword_group_keyword_keyword_group RENAME TO ix_tech_keyword_tech;
ALTER INDEX public.keyword_group_parent_child_idx       RENAME TO tech_parent_child_idx;
ALTER INDEX public.keyword_group_parent_parent_idx      RENAME TO tech_parent_parent_idx;
ALTER INDEX public.ix_mv_job_keyword_groups             RENAME TO ix_mv_job_techs;
ALTER INDEX public.ix_mv_keyword_group_category         RENAME TO ix_mv_tech_category;
ALTER INDEX public.ix_mv_keyword_group_count            RENAME TO ix_mv_tech_count;
ALTER INDEX public.ix_mv_keyword_group_keywords         RENAME TO ix_mv_tech_keywords;
ALTER INDEX public.ux_mv_keyword_group_keyword_group    RENAME TO ux_mv_tech_tech;
ALTER INDEX public.ux_mv_keyword_group_category_category RENAME TO ux_mv_tech_category_category;
ALTER INDEX public.ux_mv_keyword_group_ranking_keyword_group RENAME TO ux_mv_tech_ranking_tech;
ALTER INDEX public.ux_mv_keyword_group_tags             RENAME TO ux_mv_tech_tags;

-- ============================================================
-- 3. Rename base-table FK columns (use current table names)
-- ============================================================
ALTER TABLE public.job_keyword_group     RENAME COLUMN keyword_group TO tech;
ALTER TABLE public.keyword_group_keyword RENAME COLUMN keyword_group TO tech;

-- ============================================================
-- 4. Rename base tables
-- ============================================================
ALTER TABLE public.keyword_group         RENAME TO tech;
ALTER TABLE public.keyword_group_keyword RENAME TO tech_keyword;
ALTER TABLE public.keyword_group_parent  RENAME TO tech_parent;
ALTER TABLE public.job_keyword_group     RENAME TO job_tech;

-- ============================================================
-- 5. Rename materialized view names
-- ============================================================
ALTER MATERIALIZED VIEW public.mv_keyword_group          RENAME TO mv_tech;
ALTER MATERIALIZED VIEW public.mv_keyword_group_category RENAME TO mv_tech_category;
ALTER MATERIALIZED VIEW public.mv_keyword_group_ranking  RENAME TO mv_tech_ranking;
ALTER MATERIALIZED VIEW public.mv_keyword_group_tags     RENAME TO mv_tech_tags;

-- ============================================================
-- 6. Rename materialized-view output columns
-- ============================================================
ALTER MATERIALIZED VIEW public.mv_tech         RENAME COLUMN keyword_group TO tech;
ALTER MATERIALIZED VIEW public.mv_tech_ranking RENAME COLUMN keyword_group TO tech;
ALTER MATERIALIZED VIEW public.mv_company      RENAME COLUMN keyword_groups TO techs;
ALTER MATERIALIZED VIEW public.mv_job          RENAME COLUMN keyword_groups TO techs;
ALTER MATERIALIZED VIEW public.mv_job          RENAME COLUMN keyword_group_mappings TO tech_mappings;

-- ============================================================
-- 7. Functions
-- ============================================================
-- 7a. refresh_* : rename (keeps EXECUTE grants), then rewrite body to renamed MV.
ALTER FUNCTION public.refresh_mv_keyword_group()          RENAME TO refresh_mv_tech;
ALTER FUNCTION public.refresh_mv_keyword_group_category() RENAME TO refresh_mv_tech_category;
ALTER FUNCTION public.refresh_mv_keyword_group_ranking()  RENAME TO refresh_mv_tech_ranking;
ALTER FUNCTION public.refresh_mv_keyword_group_tags()     RENAME TO refresh_mv_tech_tags;

CREATE OR REPLACE FUNCTION public.refresh_mv_tech()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tech;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_tech_category()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tech_category;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_tech_ranking()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tech_ranking;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_tech_tags()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tech_tags;
END;
$function$;

-- 7b. reset_keywords : keeps name; update table ref + hard-coded constraint name.
CREATE OR REPLACE FUNCTION public.reset_keywords()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$BEGIN
  ALTER TABLE tech_keyword
    DROP CONSTRAINT IF EXISTS tech_keyword_mapping_keyword_fkey;

  TRUNCATE TABLE keyword;

  INSERT INTO keyword (id, count)
  SELECT kw, COUNT(*) AS count
  FROM job_keyword, UNNEST(keywords) AS kw
  GROUP BY kw

  UNION ALL

  SELECT k.keyword, 1
  FROM tech_keyword k
  WHERE k.keyword NOT IN (
    SELECT DISTINCT kw
    FROM job_keyword, UNNEST(keywords) AS kw
  );

  ALTER TABLE tech_keyword
    ADD CONSTRAINT tech_keyword_mapping_keyword_fkey
    FOREIGN KEY (keyword) REFERENCES keyword(id);
END;$function$;

-- 7c. get_jobs_by_preference : return-column rename requires DROP + CREATE; re-grant.
DROP FUNCTION IF EXISTS public.get_jobs_by_preference(uuid, text);

CREATE OR REPLACE FUNCTION public.get_jobs_by_preference(p_user_id uuid, p_preference text)
 RETURNS TABLE(id text, title text, location text, detail_link text, salary text, salary_type text, min_salary integer, max_salary integer, avg_salary numeric, created_at timestamp with time zone, updated_at timestamp with time zone, description text, company_id text, company_name text, company_link text, company_type text, techs text[], tech_mappings text[], closed boolean, description_ch_en_ratio numeric, preference_updated_at timestamp with time zone)
 LANGUAGE sql STABLE
AS $function$
  SELECT j.*, jp.updated_at AS preference_updated_at
  FROM mv_job j
  JOIN job_preference jp
    ON jp.job_id = j.id
   AND jp.user_id = p_user_id
   AND jp.preference = p_preference;
$function$;

GRANT EXECUTE ON FUNCTION public.get_jobs_by_preference(uuid, text) TO anon, authenticated, service_role;

COMMIT;
