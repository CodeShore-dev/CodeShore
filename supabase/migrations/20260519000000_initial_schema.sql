-- =============================================================================
-- Initial Schema Backup
-- Project: Jobs (lsizfvkzpwxkwvohrkmn)
-- Generated: 2026-05-19
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
-- Note: hypopg, index_advisor, supabase_vault are managed by Supabase platform

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- company
CREATE TABLE IF NOT EXISTS public.company (
  id          text        NOT NULL,
  name        text,
  link        text,
  type        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_company PRIMARY KEY (id)
);

-- keyword
CREATE TABLE IF NOT EXISTS public.keyword (
  id     text    NOT NULL,
  count  integer,
  CONSTRAINT pk_keyword PRIMARY KEY (id)
);

-- keyword_group
CREATE TABLE IF NOT EXISTS public.keyword_group (
  id        text NOT NULL,
  category  text,
  parent    text,
  CONSTRAINT pk_keyword_group PRIMARY KEY (id)
);

-- keyword_bin
CREATE TABLE IF NOT EXISTS public.keyword_bin (
  id  text NOT NULL,
  CONSTRAINT pk_keyword_bin PRIMARY KEY (id)
);

-- job
CREATE TABLE IF NOT EXISTS public.job (
  id          text        NOT NULL,
  title       text        NOT NULL,
  location    text,
  detail_link text,
  salary      text,
  description text,
  max_salary  integer,
  min_salary  integer,
  salary_type text,
  created_at  timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  updated_at  timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  company_id  text,
  closed      boolean     NOT NULL DEFAULT false,
  CONSTRAINT pk_job PRIMARY KEY (id)
);

-- job_keyword
CREATE TABLE IF NOT EXISTS public.job_keyword (
  id                      text    NOT NULL,
  keywords                text[],
  description_ch_en_ratio numeric,
  CONSTRAINT pk_job_keyword PRIMARY KEY (id)
);

-- keyword_group_keyword
CREATE TABLE IF NOT EXISTS public.keyword_group_keyword (
  keyword_group  text NOT NULL,
  keyword        text NOT NULL,
  CONSTRAINT pk_keyword_group_keyword PRIMARY KEY (keyword_group, keyword)
);

-- job_keyword_group
CREATE TABLE IF NOT EXISTS public.job_keyword_group (
  job_id         text NOT NULL,
  keyword_group  text NOT NULL,
  keywords       text,
  CONSTRAINT pk_job_keyword_group PRIMARY KEY (job_id, keyword_group)
);

-- job_preference
CREATE TABLE IF NOT EXISTS public.job_preference (
  job_id      text        NOT NULL,
  user_id     uuid        NOT NULL,
  preference  text,
  updated_at  timestamptz DEFAULT (now() AT TIME ZONE 'utc'::text),
  CONSTRAINT pk_job_preference PRIMARY KEY (job_id, user_id)
);

-- =============================================================================
-- 3. FOREIGN KEY CONSTRAINTS
-- =============================================================================

ALTER TABLE public.job
  ADD CONSTRAINT job_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.company(id)
  ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE public.job_keyword
  ADD CONSTRAINT job_keyword_id_fkey
  FOREIGN KEY (id) REFERENCES public.job(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.keyword_group_keyword
  ADD CONSTRAINT keyword_group_keyword_keyword_group_fkey
  FOREIGN KEY (keyword_group) REFERENCES public.keyword_group(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.keyword_group_keyword
  ADD CONSTRAINT keyword_group_keyword_mapping_keyword_fkey
  FOREIGN KEY (keyword) REFERENCES public.keyword(id)
  ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE public.job_keyword_group
  ADD CONSTRAINT job_keyword_group_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.job(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.job_keyword_group
  ADD CONSTRAINT job_keyword_group_keyword_group_fkey
  FOREIGN KEY (keyword_group) REFERENCES public.keyword_group(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.job_preference
  ADD CONSTRAINT job_preference_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.job(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.job_preference
  ADD CONSTRAINT job_preference_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON UPDATE NO ACTION ON DELETE NO ACTION;

-- =============================================================================
-- 4. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS ix_job_company_id
  ON public.job USING btree (company_id);

CREATE INDEX IF NOT EXISTS ix_job_min_salary_max_salary_updated_at
  ON public.job USING btree (min_salary DESC, max_salary DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_job_closed_company_id
  ON public.job USING btree (closed, company_id);

CREATE INDEX IF NOT EXISTS ix_job_closed
  ON public.job USING btree (closed);

CREATE INDEX IF NOT EXISTS ix_job_keyword_group_job_id
  ON public.job_keyword_group USING btree (job_id);

CREATE INDEX IF NOT EXISTS ix_job_keyword_group_keyword_group
  ON public.job_keyword_group USING btree (keyword_group);

CREATE INDEX IF NOT EXISTS ix_job_preference_user_id_job_id
  ON public.job_preference USING btree (user_id, job_id);

CREATE INDEX IF NOT EXISTS ix_job_preference_user_id
  ON public.job_preference USING btree (user_id);

CREATE INDEX IF NOT EXISTS ix_keyword_group_parent
  ON public.keyword_group USING btree (parent);

CREATE INDEX IF NOT EXISTS ix_keyword_group_keyword_keyword_group
  ON public.keyword_group_keyword USING btree (keyword_group);

CREATE INDEX IF NOT EXISTS ix_keyword_group_keyword_keyword
  ON public.keyword_group_keyword USING btree (keyword);

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.company              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_keyword_group    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_keyword          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_preference       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_bin          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_group        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_group_keyword ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. MATERIALIZED VIEWS
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_keyword_group_category AS
SELECT category,
    count(*) AS count
FROM keyword_group
GROUP BY category
ORDER BY (count(*)) DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_keyword_group AS
SELECT COALESCE(kg.id, k.id) AS keyword_group,
    sum(k.count) AS count,
    array_agg(k.id) AS keywords,
    kg.category,
    kg.parent
FROM (((keyword k
    LEFT JOIN keyword_group_keyword kgkm ON ((k.id = kgkm.keyword)))
    LEFT JOIN keyword_group kg ON ((kgkm.keyword_group = kg.id)))
    LEFT JOIN keyword_bin kb ON ((k.id = kb.id)))
WHERE (kb.id IS NULL)
GROUP BY COALESCE(kg.id, k.id), kg.category, kg.parent
HAVING (sum(k.count) > 2)
ORDER BY (sum(k.count)) DESC, COALESCE(kg.id, k.id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_company AS
SELECT c.id AS company_id,
    c.name AS company_name,
    c.link AS company_link,
    c.type AS company_type,
    count(DISTINCT j.id) AS job_count,
    array_agg(DISTINCT jkg.keyword_group) AS keyword_groups
FROM ((company c
    JOIN job j ON ((j.company_id = c.id)))
    JOIN job_keyword_group jkg ON ((jkg.job_id = j.id)))
WHERE (j.closed = false)
GROUP BY c.id, c.name, c.link, c.type
HAVING (count(DISTINCT j.id) > 0)
ORDER BY (count(DISTINCT j.id)) DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_job AS
SELECT j.id,
    j.title,
    j.location,
    j.detail_link,
    j.salary,
    j.salary_type,
    j.min_salary,
    j.max_salary,
    j.created_at,
    j.updated_at,
    j.description,
    c.id AS company_id,
    c.name AS company_name,
    c.link AS company_link,
    c.type AS company_type,
    array_agg(jkg.keyword_group) FILTER (WHERE (jkg.keyword_group IS NOT NULL)) AS keyword_groups,
    array_agg(((jkg.keyword_group || ':'::text) || jkg.keywords)) FILTER (WHERE (jkg.keyword_group IS NOT NULL)) AS keyword_group_mappings,
    j.closed,
    jk.description_ch_en_ratio
FROM (((job j
    JOIN job_keyword jk ON ((jk.id = j.id)))
    JOIN company c ON ((j.company_id = c.id)))
    LEFT JOIN job_keyword_group jkg ON ((jkg.job_id = j.id)))
WHERE (j.closed = false)
GROUP BY j.id, j.title, j.location, j.detail_link, j.salary, j.salary_type, j.min_salary, j.max_salary, j.created_at, j.updated_at, j.description, c.id, c.name, c.link, c.type, jk.description_ch_en_ratio, j.closed
ORDER BY j.min_salary DESC, j.max_salary DESC, j.updated_at DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tech_combo_stats AS
SELECT a.keyword_group AS tech1,
    b.keyword_group AS tech2,
    kga.category AS cat1,
    kgb.category AS cat2,
    count(DISTINCT a.job_id) AS job_count,
    round(avg(
        CASE
            WHEN ((j.salary_type = 'month'::text) AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.min_salary)::numeric
            ELSE NULL::numeric
        END)) AS avg_min_month,
    round(avg(
        CASE
            WHEN ((j.salary_type = 'month'::text) AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.max_salary)::numeric
            ELSE NULL::numeric
        END)) AS avg_max_month,
    round(avg(
        CASE
            WHEN ((j.salary_type = 'year'::text) AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.min_salary)::numeric
            ELSE NULL::numeric
        END)) AS avg_min_year,
    round(avg(
        CASE
            WHEN ((j.salary_type = 'year'::text) AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.max_salary)::numeric
            ELSE NULL::numeric
        END)) AS avg_max_year
FROM ((((job_keyword_group a
    JOIN job_keyword_group b ON (((a.job_id = b.job_id) AND (a.keyword_group < b.keyword_group))))
    JOIN job j ON ((j.id = a.job_id)))
    JOIN keyword_group kga ON ((kga.id = a.keyword_group)))
    JOIN keyword_group kgb ON ((kgb.id = b.keyword_group)))
WHERE ((kga.category = ANY (ARRAY['Language'::text, 'Framework'::text])) AND (kgb.category = ANY (ARRAY['Language'::text, 'Framework'::text])) AND (NOT ((kga.parent = kgb.id) OR (kgb.parent = kga.id))) AND (a.keyword_group <> ALL (ARRAY['css'::text, 'html'::text, 'javascript'::text, 'sql'::text])) AND (b.keyword_group <> ALL (ARRAY['css'::text, 'html'::text, 'javascript'::text, 'sql'::text])))
GROUP BY a.keyword_group, b.keyword_group, kga.category, kgb.category
HAVING (count(DISTINCT a.job_id) >= 10)
ORDER BY (count(DISTINCT a.job_id)) DESC;

-- =============================================================================
-- 7. INDEXES ON MATERIALIZED VIEWS
-- =============================================================================

CREATE INDEX IF NOT EXISTS ix_mv_company_job_count
  ON public.mv_company USING btree (job_count);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_keyword_group_keyword_group
  ON public.mv_keyword_group USING btree (keyword_group);

CREATE INDEX IF NOT EXISTS ix_mv_keyword_group_count
  ON public.mv_keyword_group USING btree (count DESC);

CREATE INDEX IF NOT EXISTS ix_mv_keyword_group_parent
  ON public.mv_keyword_group USING btree (parent);

CREATE INDEX IF NOT EXISTS ix_mv_tech_combo_stats_job_count
  ON public.mv_tech_combo_stats USING btree (job_count DESC);

-- =============================================================================
-- 8. FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_weighted_market_ratio()
RETURNS TABLE(weighted_market_ratio numeric, total_valid_samples bigint)
LANGUAGE sql
AS $function$
  WITH ratio_counts as (
    select
      ROUND(CAST(max_salary as NUMERIC) / min_salary, 2) as ratio,
      COUNT(*) as group_count
    from
      job
    where
      min_salary > 0
      and max_salary < 9999999 -- 排除「以上」和「面議」
      and max_salary >= min_salary
    group by
      1
    order by group_count desc
  )
  select
    -- 公式：SUM(比例 * 該比例的人數) / 總人數
    ROUND(SUM(ratio * group_count) / SUM(group_count), 2) as weighted_market_ratio,
    SUM(group_count) as total_valid_samples
  from
    ratio_counts;
$function$;

CREATE OR REPLACE FUNCTION public.get_job_count()
RETURNS TABLE(month_salary_type_jobs numeric, year_salary_type_jobs numeric, jobs numeric)
LANGUAGE sql
AS $function$select
  (
    select
      count(*) filter (
        where
          max_salary <> 9999999
          and min_salary <> 0
          and salary_type = 'month'
      )
    from
      job
  ) as month_salary_type_jobs,
  (
    select
      count(*) filter (
        where
          max_salary <> 9999999
          and min_salary <> 0
          and salary_type = 'year'
      )
    from
      job
  ) as year_salary_type_jobs,
  (
    select
      count(*)
    from
      job
    where closed = false
  ) as jobs$function$;

CREATE OR REPLACE FUNCTION public.get_job_salary_stats()
RETURNS TABLE(avg_min_salary_month numeric, avg_max_salary_month numeric, avg_min_salary_year numeric, avg_max_salary_year numeric)
LANGUAGE sql
AS $function$
  select
    avg(min_salary) filter (where min_salary <> 0 and salary_type = 'month') as avg_min_salary_month,
    avg(max_salary) filter (where max_salary <> 9999999 and salary_type = 'month') as avg_max_salary_month,
    avg(min_salary) filter (where min_salary <> 0 and salary_type = 'year') as avg_min_salary_year,
    avg(max_salary) filter (where max_salary <> 9999999 and salary_type = 'year') as avg_max_salary_year
  from job;
$function$;

CREATE OR REPLACE FUNCTION public.get_salary_stats()
RETURNS TABLE(salary_type text, avg_mark numeric, high_mark numeric, top_mark numeric)
LANGUAGE sql
STABLE
AS $function$WITH

  -- Step 1: 取得市場加權比例（用於「以上」薪資的上限估算）
  ratio_counts AS (
    SELECT
      ROUND(CAST(max_salary AS numeric) / min_salary, 2) AS ratio,
      COUNT(*) AS group_count
    FROM job
    WHERE
      min_salary > 0
      AND max_salary < 9999999   -- 排除「以上」和「面議」
      AND max_salary >= min_salary
    GROUP BY 1
  ),

  weighted_ratio AS (
    SELECT
      ROUND(SUM(ratio * group_count) / SUM(group_count), 2) AS ratio
    FROM ratio_counts
  ),

  -- Step 2: 每個職缺算出代表薪資
  job_salary AS (
    SELECT
      j.salary_type,
      CASE
        -- 範圍薪資：取中間值
        WHEN j.min_salary > 0 AND j.max_salary < 9999999 AND j.max_salary >= j.min_salary
          THEN ROUND((j.min_salary + j.max_salary) / 2.0, 0)
        -- 「以上」薪資：min * weighted_market_ratio
        WHEN j.min_salary > 0 AND j.max_salary = 9999999
          THEN ROUND((j.min_salary + j.min_salary * wr.ratio) / 2.0, 0)
        -- 其餘（面議等）排除
        ELSE NULL
      END AS representative_salary
    FROM job j
    CROSS JOIN weighted_ratio wr
    WHERE
      j.salary_type IN ('month', 'year')
      AND j.closed = false
  )

  -- Step 3: 對月薪 / 年薪分別算均標、高標、頂標
  SELECT
    salary_type,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0)  AS avg_mark,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS high_mark,
    ROUND(PERCENTILE_CONT(0.88) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS top_mark
  FROM job_salary
  WHERE representative_salary IS NOT NULL
  GROUP BY salary_type
  ORDER BY salary_type;$function$;

CREATE OR REPLACE FUNCTION public.reset_keywords()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$BEGIN
  ALTER TABLE keyword_group_keyword
    DROP CONSTRAINT IF EXISTS keyword_group_keyword_mapping_keyword_fkey;

  TRUNCATE TABLE keyword;

  INSERT INTO keyword (id, count)
  -- Source 1: from job_keyword, with real counts
  SELECT kw, COUNT(*) AS count
  FROM job_keyword, UNNEST(keywords) AS kw
  GROUP BY kw

  UNION ALL

  -- Source 2: keywords in keyword_group_keyword not covered by job_keyword, count = 1
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

CREATE OR REPLACE FUNCTION public.get_tech_salary_stats(p_limit integer DEFAULT 20)
RETURNS TABLE(keyword_group text, category text, job_count bigint, avg_min_month numeric, avg_max_month numeric, avg_min_year numeric, avg_max_year numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$BEGIN
  RETURN QUERY
  SELECT
    jjkg.keyword_group,
    kg.category,
    COUNT(DISTINCT jjkg.job_id)::bigint AS job_count,
    ROUND(AVG(CASE WHEN j.salary_type = 'month' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.min_salary::numeric END)) AS avg_min_month,
    ROUND(AVG(CASE WHEN j.salary_type = 'month' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.max_salary::numeric END)) AS avg_max_month,
    ROUND(AVG(CASE WHEN j.salary_type = 'year' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.min_salary::numeric END)) AS avg_min_year,
    ROUND(AVG(CASE WHEN j.salary_type = 'year' AND j.min_salary > 0 AND j.max_salary < 9999999 THEN j.max_salary::numeric END)) AS avg_max_year
  FROM job_keyword_group jjkg
  JOIN job j ON j.id = jjkg.job_id
  JOIN keyword_group kg ON kg.id = jjkg.keyword_group
  WHERE kg.category IN ('Language', 'Framework')
  GROUP BY jjkg.keyword_group, kg.category
  HAVING COUNT(DISTINCT jjkg.job_id) >= 5
  ORDER BY COUNT(DISTINCT jjkg.job_id) DESC
  LIMIT p_limit;
END;$function$;

-- Depends on mv_job
CREATE OR REPLACE FUNCTION public.get_unreviewed_jobs(p_user_id uuid)
RETURNS SETOF mv_job
LANGUAGE sql
STABLE
AS $function$
   SELECT j.*
   FROM mv_job j
   WHERE NOT EXISTS (
     SELECT 1 FROM job_preference jp
     WHERE jp.job_id = j.id
       AND jp.user_id = p_user_id
   );
 $function$;

-- Depends on mv_tech_combo_stats
CREATE OR REPLACE FUNCTION public.get_tech_combo_stats(p_limit integer DEFAULT 15)
RETURNS TABLE(tech1 text, tech2 text, cat1 text, cat2 text, job_count bigint, avg_min_month numeric, avg_max_month numeric, avg_min_year numeric, avg_max_year numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT tech1, tech2, cat1, cat2, job_count,
         avg_min_month, avg_max_month, avg_min_year, avg_max_year
  FROM public.mv_tech_combo_stats
  LIMIT p_limit;
$function$;

-- Depends on mv_company
CREATE OR REPLACE FUNCTION public.refresh_mv_company()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  refresh materialized view concurrently public.mv_company;
end;
$function$;

-- Depends on mv_keyword_group
CREATE OR REPLACE FUNCTION public.refresh_mv_keyword_group()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  refresh materialized view concurrently public.mv_keyword_group;
end;
$function$;
