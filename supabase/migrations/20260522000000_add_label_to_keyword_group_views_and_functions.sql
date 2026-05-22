-- ================================================================
-- Migration: add_label_to_keyword_group_views_and_functions
-- Date: 2026-05-22
-- Purpose:
--   keyword_group 表新增 label 欄位（網頁顯示用），
--   更新所有相關 materialized view 與 function，
--   讓前端各處改用 label 取代原本顯示的 id。
-- ================================================================

-- ================================================================
-- 1. mv_keyword_group：加入 label 欄位
--    label 優先取 keyword_group.label，fallback 到 keyword_group（id）
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_keyword_group CASCADE;

CREATE MATERIALIZED VIEW mv_keyword_group AS
SELECT
  COALESCE(kg.id, k.id)                              AS keyword_group,
  COALESCE(MAX(kg.label), COALESCE(kg.id, k.id))     AS label,
  sum(k.count)                                       AS count,
  array_agg(k.id)                                    AS keywords,
  kg.category,
  kg.parent
FROM (((keyword k
  LEFT JOIN keyword_group_keyword kgkm ON (k.id = kgkm.keyword))
  LEFT JOIN keyword_group kg            ON (kgkm.keyword_group = kg.id))
  LEFT JOIN keyword_bin kb              ON (k.id = kb.id))
WHERE kb.id IS NULL
GROUP BY COALESCE(kg.id, k.id), kg.category, kg.parent
HAVING sum(k.count) > 2
ORDER BY sum(k.count) DESC, COALESCE(kg.id, k.id);

CREATE UNIQUE INDEX ux_mv_keyword_group_keyword_group
  ON mv_keyword_group USING btree (keyword_group);

CREATE INDEX ix_mv_keyword_group_count
  ON mv_keyword_group USING btree (count DESC);

-- ================================================================
-- 2. mv_tech_combo_stats：加入 tech1_label, tech2_label
--    kga/kgb 在 group 內值唯一，用 MAX 避開 GROUP BY 限制
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_tech_combo_stats CASCADE;

CREATE MATERIALIZED VIEW mv_tech_combo_stats AS
SELECT
  a.keyword_group                                     AS tech1,
  b.keyword_group                                     AS tech2,
  COALESCE(MAX(kga.label), a.keyword_group)           AS tech1_label,
  COALESCE(MAX(kgb.label), b.keyword_group)           AS tech2_label,
  MAX(kga.category)                                   AS cat1,
  MAX(kgb.category)                                   AS cat2,
  count(DISTINCT a.job_id)                            AS job_count,
  round(avg(CASE WHEN j.salary_type = 'month' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.min_salary::numeric END)) AS avg_min_month,
  round(avg(CASE WHEN j.salary_type = 'month' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.max_salary::numeric END)) AS avg_max_month,
  round(avg(CASE WHEN j.salary_type = 'year'  AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.min_salary::numeric END)) AS avg_min_year,
  round(avg(CASE WHEN j.salary_type = 'year'  AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.max_salary::numeric END)) AS avg_max_year
FROM ((((job_keyword_group a
  JOIN job_keyword_group b  ON (a.job_id = b.job_id AND a.keyword_group < b.keyword_group))
  JOIN job j                ON (j.id = a.job_id))
  JOIN keyword_group kga    ON (kga.id = a.keyword_group))
  JOIN keyword_group kgb    ON (kgb.id = b.keyword_group))
WHERE
  kga.category = ANY (ARRAY['Language','Framework'])
  AND kgb.category = ANY (ARRAY['Language','Framework'])
  AND NOT (kga.parent = kgb.id OR kgb.parent = kga.id)
  AND a.keyword_group <> ALL (ARRAY['css','html','javascript','sql'])
  AND b.keyword_group <> ALL (ARRAY['css','html','javascript','sql'])
GROUP BY a.keyword_group, b.keyword_group
HAVING count(DISTINCT a.job_id) >= 10
ORDER BY count(DISTINCT a.job_id) DESC;

-- ================================================================
-- 3. get_tech_salary_stats：回傳中加入 label
-- ================================================================
DROP FUNCTION IF EXISTS public.get_tech_salary_stats(integer);

CREATE FUNCTION public.get_tech_salary_stats(p_limit integer DEFAULT 20)
RETURNS TABLE(
  keyword_group  text,
  label          text,
  category       text,
  job_count      bigint,
  avg_min_month  numeric,
  avg_max_month  numeric,
  avg_min_year   numeric,
  avg_max_year   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    jjkg.keyword_group,
    COALESCE(kg.label, kg.id)                                                                           AS label,
    kg.category,
    COUNT(DISTINCT jjkg.job_id)::bigint                                                                 AS job_count,
    ROUND(AVG(CASE WHEN j.salary_type = 'month' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.min_salary::numeric END)) AS avg_min_month,
    ROUND(AVG(CASE WHEN j.salary_type = 'month' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.max_salary::numeric END)) AS avg_max_month,
    ROUND(AVG(CASE WHEN j.salary_type = 'year'  AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.min_salary::numeric END)) AS avg_min_year,
    ROUND(AVG(CASE WHEN j.salary_type = 'year'  AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.max_salary::numeric END)) AS avg_max_year
  FROM job_keyword_group jjkg
  JOIN job j            ON j.id = jjkg.job_id
  JOIN keyword_group kg ON kg.id = jjkg.keyword_group
  WHERE kg.category IN ('Language', 'Framework')
  GROUP BY jjkg.keyword_group, kg.id, kg.label, kg.category
  HAVING COUNT(DISTINCT jjkg.job_id) >= 5
  ORDER BY COUNT(DISTINCT jjkg.job_id) DESC
  LIMIT p_limit;
END;
$function$;

-- ================================================================
-- 4. get_tech_combo_stats：回傳中加入 tech1_label, tech2_label
-- ================================================================
DROP FUNCTION IF EXISTS public.get_tech_combo_stats(integer);

CREATE FUNCTION public.get_tech_combo_stats(p_limit integer DEFAULT 15)
RETURNS TABLE(
  tech1          text,
  tech2          text,
  tech1_label    text,
  tech2_label    text,
  cat1           text,
  cat2           text,
  job_count      bigint,
  avg_min_month  numeric,
  avg_max_month  numeric,
  avg_min_year   numeric,
  avg_max_year   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
  SELECT tech1, tech2, tech1_label, tech2_label, cat1, cat2, job_count,
         avg_min_month, avg_max_month, avg_min_year, avg_max_year
  FROM public.mv_tech_combo_stats
  LIMIT p_limit;
$function$;
