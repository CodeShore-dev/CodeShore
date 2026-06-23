-- Rollback migration: revert the `tech` rename back to `keyword_group`.
-- Spec: .kiro/specs/rename-keyword-group-to-tech
-- Exact inverse of 20260623120000_rename_keyword_group_to_tech.sql.
-- Apply only if the forward cutover must be reverted. Transactional/atomic.

BEGIN;

-- ============================================================
-- 1. Revert constraint names (tables currently named tech*)
-- ============================================================
ALTER TABLE public.tech         RENAME CONSTRAINT pk_tech TO pk_keyword_group;
ALTER TABLE public.tech_keyword RENAME CONSTRAINT pk_tech_keyword TO pk_keyword_group_keyword;
ALTER TABLE public.tech_keyword RENAME CONSTRAINT tech_keyword_join_tech_fkey TO keyword_group_join_keyword_keyword_group_fkey;
ALTER TABLE public.tech_keyword RENAME CONSTRAINT tech_keyword_mapping_keyword_fkey TO keyword_group_keyword_mapping_keyword_fkey;
ALTER TABLE public.tech_parent  RENAME CONSTRAINT tech_parent_pkey TO keyword_group_parent_pkey;
ALTER TABLE public.tech_parent  RENAME CONSTRAINT tech_parent_child_fkey TO keyword_group_parent_child_fkey;
ALTER TABLE public.tech_parent  RENAME CONSTRAINT tech_parent_parent_fkey TO keyword_group_parent_parent_fkey;
ALTER TABLE public.job_tech     RENAME CONSTRAINT pk_job_tech TO pk_job_keyword_group;
ALTER TABLE public.job_tech     RENAME CONSTRAINT job_join_tech_job_id_fkey TO job_join_keyword_group_job_id_fkey;
ALTER TABLE public.job_tech     RENAME CONSTRAINT job_join_tech_tech_fkey TO job_join_keyword_group_keyword_group_fkey;

-- ============================================================
-- 2. Revert index names
-- ============================================================
ALTER INDEX public.ix_job_tech_job_id              RENAME TO ix_job_keyword_group_job_id;
ALTER INDEX public.ix_job_tech_tech                RENAME TO ix_job_keyword_group_keyword_group;
ALTER INDEX public.tech_category_idx               RENAME TO keyword_group_category_idx;
ALTER INDEX public.ix_tech_keyword_keyword         RENAME TO ix_keyword_group_keyword_keyword;
ALTER INDEX public.ix_tech_keyword_tech            RENAME TO ix_keyword_group_keyword_keyword_group;
ALTER INDEX public.tech_parent_child_idx           RENAME TO keyword_group_parent_child_idx;
ALTER INDEX public.tech_parent_parent_idx          RENAME TO keyword_group_parent_parent_idx;
ALTER INDEX public.ix_mv_job_techs                 RENAME TO ix_mv_job_keyword_groups;
ALTER INDEX public.ix_mv_tech_category             RENAME TO ix_mv_keyword_group_category;
ALTER INDEX public.ix_mv_tech_count                RENAME TO ix_mv_keyword_group_count;
ALTER INDEX public.ix_mv_tech_keywords             RENAME TO ix_mv_keyword_group_keywords;
ALTER INDEX public.ux_mv_tech_tech                 RENAME TO ux_mv_keyword_group_keyword_group;
ALTER INDEX public.ux_mv_tech_category_category    RENAME TO ux_mv_keyword_group_category_category;
ALTER INDEX public.ux_mv_tech_ranking_tech         RENAME TO ux_mv_keyword_group_ranking_keyword_group;
ALTER INDEX public.ux_mv_tech_tags                 RENAME TO ux_mv_keyword_group_tags;

-- ============================================================
-- 3. Revert base-table FK columns
-- ============================================================
ALTER TABLE public.job_tech     RENAME COLUMN tech TO keyword_group;
ALTER TABLE public.tech_keyword RENAME COLUMN tech TO keyword_group;

-- ============================================================
-- 4. Revert base table names
-- ============================================================
ALTER TABLE public.tech         RENAME TO keyword_group;
ALTER TABLE public.tech_keyword RENAME TO keyword_group_keyword;
ALTER TABLE public.tech_parent  RENAME TO keyword_group_parent;
ALTER TABLE public.job_tech     RENAME TO job_keyword_group;

-- ============================================================
-- 5. Revert materialized view names
-- ============================================================
ALTER MATERIALIZED VIEW public.mv_tech          RENAME TO mv_keyword_group;
ALTER MATERIALIZED VIEW public.mv_tech_category RENAME TO mv_keyword_group_category;
ALTER MATERIALIZED VIEW public.mv_tech_ranking  RENAME TO mv_keyword_group_ranking;
ALTER MATERIALIZED VIEW public.mv_tech_tags     RENAME TO mv_keyword_group_tags;

-- ============================================================
-- 6. Revert materialized-view output columns
-- ============================================================
ALTER MATERIALIZED VIEW public.mv_keyword_group         RENAME COLUMN tech TO keyword_group;
ALTER MATERIALIZED VIEW public.mv_keyword_group_ranking RENAME COLUMN tech TO keyword_group;
ALTER MATERIALIZED VIEW public.mv_company               RENAME COLUMN techs TO keyword_groups;
ALTER MATERIALIZED VIEW public.mv_job                   RENAME COLUMN techs TO keyword_groups;
ALTER MATERIALIZED VIEW public.mv_job                   RENAME COLUMN tech_mappings TO keyword_group_mappings;

-- ============================================================
-- 7. Functions
-- ============================================================
ALTER FUNCTION public.refresh_mv_tech()          RENAME TO refresh_mv_keyword_group;
ALTER FUNCTION public.refresh_mv_tech_category()  RENAME TO refresh_mv_keyword_group_category;
ALTER FUNCTION public.refresh_mv_tech_ranking()   RENAME TO refresh_mv_keyword_group_ranking;
ALTER FUNCTION public.refresh_mv_tech_tags()      RENAME TO refresh_mv_keyword_group_tags;

CREATE OR REPLACE FUNCTION public.refresh_mv_keyword_group()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_keyword_group;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_keyword_group_category()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_keyword_group_category;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_keyword_group_ranking()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_keyword_group_ranking;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_keyword_group_tags()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_keyword_group_tags;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_keywords()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $function$BEGIN
  ALTER TABLE keyword_group_keyword
    DROP CONSTRAINT IF EXISTS keyword_group_keyword_mapping_keyword_fkey;

  TRUNCATE TABLE keyword;

  INSERT INTO keyword (id, count)
  SELECT kw, COUNT(*) AS count
  FROM job_keyword, UNNEST(keywords) AS kw
  GROUP BY kw

  UNION ALL

  SELECT k.keyword, 1
  FROM keyword_group_keyword k
  WHERE k.keyword NOT IN (
    SELECT DISTINCT kw
    FROM job_keyword, UNNEST(keywords) AS kw
  );

  ALTER TABLE keyword_group_keyword
    ADD CONSTRAINT keyword_group_keyword_mapping_keyword_fkey
    FOREIGN KEY (keyword) REFERENCES keyword(id);
END;$function$;

DROP FUNCTION IF EXISTS public.get_jobs_by_preference(uuid, text);

CREATE OR REPLACE FUNCTION public.get_jobs_by_preference(p_user_id uuid, p_preference text)
 RETURNS TABLE(id text, title text, location text, detail_link text, salary text, salary_type text, min_salary integer, max_salary integer, avg_salary numeric, created_at timestamp with time zone, updated_at timestamp with time zone, description text, company_id text, company_name text, company_link text, company_type text, keyword_groups text[], keyword_group_mappings text[], closed boolean, description_ch_en_ratio numeric, preference_updated_at timestamp with time zone)
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
