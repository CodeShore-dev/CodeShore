-- =============================================================================
-- Full Schema Snapshot
-- Project: Jobs (lsizfvkzpwxkwvohrkmn)
-- Generated: 2026-05-28
-- Purpose: Complete, idempotent snapshot of the entire DB.
--          Apply this file alone on a fresh Supabase project to rebuild.
-- =============================================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Note: hypopg, index_advisor, supabase_vault are managed by the Supabase platform

-- ============================================================
-- 2. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company (
    id          text        NOT NULL,
    name        text,
    link        text,
    type        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_company PRIMARY KEY (id)
);

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

CREATE TABLE IF NOT EXISTS public.job_description_bin (
    id      uuid NOT NULL DEFAULT gen_random_uuid(),
    content text,
    CONSTRAINT job_description_bin_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.job_keyword (
    id                      text    NOT NULL,
    keywords                text[],
    description_ch_en_ratio numeric,
    CONSTRAINT pk_job_keyword PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.job_keyword_group (
    job_id        text NOT NULL,
    keyword_group text NOT NULL,
    keywords      text,
    CONSTRAINT pk_job_keyword_group PRIMARY KEY (job_id, keyword_group)
);

CREATE TABLE IF NOT EXISTS public.job_preference (
    job_id     text        NOT NULL,
    user_id    uuid        NOT NULL,
    preference text,
    updated_at timestamptz DEFAULT (now() AT TIME ZONE 'utc'::text),
    CONSTRAINT pk_job_preference PRIMARY KEY (job_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.job_source (
    url text NOT NULL,
    CONSTRAINT job_source_pkey PRIMARY KEY (url)
);

CREATE TABLE IF NOT EXISTS public.job_source_url (
    url        text   NOT NULL,
    page_index bigint NOT NULL DEFAULT 1::bigint,
    status     text,
    CONSTRAINT job_source_urls_pkey PRIMARY KEY (url, page_index)
);

CREATE TABLE IF NOT EXISTS public.keyword (
    id    text    NOT NULL,
    count integer,
    CONSTRAINT pk_keyword PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.keyword_bin (
    id text NOT NULL,
    CONSTRAINT pk_keyword_bin PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.keyword_group (
    id       text NOT NULL,
    category text,
    parent   text,
    label    text,
    CONSTRAINT pk_keyword_group PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.keyword_group_keyword (
    keyword_group text NOT NULL,
    keyword       text NOT NULL,
    CONSTRAINT pk_keyword_group_keyword PRIMARY KEY (keyword_group, keyword)
);

CREATE TABLE IF NOT EXISTS public.location_group (
    id text NOT NULL,
    CONSTRAINT location_group_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.location_group_location (
    location_group text NOT NULL,
    location       text NOT NULL,
    CONSTRAINT location_group_location_pkey PRIMARY KEY (location_group, location)
);

-- ============================================================
-- 3. FOREIGN KEY CONSTRAINTS
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_company_id_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.job ADD CONSTRAINT job_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.company(id) ON UPDATE CASCADE ON DELETE NO ACTION;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_keyword_id_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.job_keyword ADD CONSTRAINT job_keyword_id_fkey FOREIGN KEY (id) REFERENCES public.job(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_keyword_group_job_id_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.job_keyword_group ADD CONSTRAINT job_keyword_group_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_keyword_group_keyword_group_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.job_keyword_group ADD CONSTRAINT job_keyword_group_keyword_group_fkey FOREIGN KEY (keyword_group) REFERENCES public.keyword_group(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_preference_job_id_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.job_preference ADD CONSTRAINT job_preference_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_preference_user_id_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.job_preference ADD CONSTRAINT job_preference_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'keyword_group_keyword_mapping_keyword_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.keyword_group_keyword ADD CONSTRAINT keyword_group_keyword_mapping_keyword_fkey FOREIGN KEY (keyword) REFERENCES public.keyword(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'keyword_group_keyword_keyword_group_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.keyword_group_keyword ADD CONSTRAINT keyword_group_keyword_keyword_group_fkey FOREIGN KEY (keyword_group) REFERENCES public.keyword_group(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'keyword_group_parent_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.keyword_group ADD CONSTRAINT keyword_group_parent_fkey FOREIGN KEY (parent) REFERENCES public.keyword_group(id);
    END IF;
END; $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'location_group_location_location_group_fkey' AND table_schema = 'public') THEN
        ALTER TABLE public.location_group_location ADD CONSTRAINT location_group_location_location_group_fkey FOREIGN KEY (location_group) REFERENCES public.location_group(id);
    END IF;
END; $$;

-- ============================================================
-- 4. INDEXES (base tables)
-- ============================================================

CREATE INDEX IF NOT EXISTS ix_job_closed
    ON public.job USING btree (closed);

CREATE INDEX IF NOT EXISTS ix_job_closed_company_id
    ON public.job USING btree (closed, company_id);

CREATE INDEX IF NOT EXISTS ix_job_company_id
    ON public.job USING btree (company_id);

CREATE INDEX IF NOT EXISTS ix_job_min_salary_max_salary_updated_at
    ON public.job USING btree (min_salary DESC, max_salary DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS job_location_idx
    ON public.job USING btree (location);

CREATE INDEX IF NOT EXISTS job_salary_idx
    ON public.job USING btree (salary);

CREATE INDEX IF NOT EXISTS ix_job_keyword_group_job_id
    ON public.job_keyword_group USING btree (job_id);

CREATE INDEX IF NOT EXISTS ix_job_keyword_group_keyword_group
    ON public.job_keyword_group USING btree (keyword_group);

CREATE INDEX IF NOT EXISTS ix_job_preference_user_id
    ON public.job_preference USING btree (user_id);

CREATE INDEX IF NOT EXISTS ix_job_preference_user_id_job_id
    ON public.job_preference USING btree (user_id, job_id);

CREATE INDEX IF NOT EXISTS ix_keyword_group_parent
    ON public.keyword_group USING btree (parent);

CREATE INDEX IF NOT EXISTS ix_keyword_group_keyword_keyword
    ON public.keyword_group_keyword USING btree (keyword);

CREATE INDEX IF NOT EXISTS ix_keyword_group_keyword_keyword_group
    ON public.keyword_group_keyword USING btree (keyword_group);

CREATE INDEX IF NOT EXISTS location_group_location_location_group_idx
    ON public.location_group_location USING btree (location_group);

CREATE INDEX IF NOT EXISTS location_group_location_location_idx
    ON public.location_group_location USING btree (location);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.company                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_description_bin    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_keyword            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_keyword_group      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_preference         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source_url         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_bin            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_group          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_group_keyword  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_group         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_group_location ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. REGULAR VIEWS
-- ============================================================

-- No regular views.

-- ============================================================
-- 7. MATERIALIZED VIEWS (indexes inline after each view)
-- ============================================================

-- ------------------------------------------------------------
-- mv_keyword_group_category
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_keyword_group_category CASCADE;

CREATE MATERIALIZED VIEW public.mv_keyword_group_category AS
SELECT category,
    count(*) AS count
FROM public.keyword_group
GROUP BY category
ORDER BY (count(*)) DESC
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_keyword_group_category_category
    ON public.mv_keyword_group_category USING btree (category);

-- ------------------------------------------------------------
-- mv_keyword_group
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_keyword_group CASCADE;

CREATE MATERIALIZED VIEW public.mv_keyword_group AS
SELECT COALESCE(kg.id, k.id)                           AS keyword_group,
    COALESCE(max(kg.label), COALESCE(kg.id, k.id))     AS label,
    sum(k.count)                                       AS count,
    array_agg(k.id)                                    AS keywords,
    kg.category,
    kg.parent
FROM (((public.keyword k
    LEFT JOIN public.keyword_group_keyword kgkm ON ((k.id = kgkm.keyword)))
    LEFT JOIN public.keyword_group kg ON ((kgkm.keyword_group = kg.id)))
    LEFT JOIN public.keyword_bin kb ON ((k.id = kb.id)))
WHERE (kb.id IS NULL)
GROUP BY COALESCE(kg.id, k.id), kg.category, kg.parent
HAVING (sum(k.count) > 2)
ORDER BY (sum(k.count)) DESC, COALESCE(kg.id, k.id)
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_keyword_group_keyword_group
    ON public.mv_keyword_group USING btree (keyword_group);

CREATE INDEX IF NOT EXISTS ix_mv_keyword_group_count
    ON public.mv_keyword_group USING btree (count DESC);

CREATE INDEX IF NOT EXISTS ix_mv_keyword_group_parent
    ON public.mv_keyword_group USING btree (parent);

CREATE INDEX IF NOT EXISTS ix_mv_keyword_group_category
    ON public.mv_keyword_group USING btree (category);

CREATE INDEX IF NOT EXISTS ix_mv_keyword_group_keywords
    ON public.mv_keyword_group USING gin (keywords);

-- ------------------------------------------------------------
-- mv_keyword_group_ranking
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_keyword_group_ranking CASCADE;

CREATE MATERIALIZED VIEW public.mv_keyword_group_ranking AS
SELECT jjkg.keyword_group,
    kg.category,
    kg.label,
    count(DISTINCT jjkg.job_id) AS job_count,
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
FROM ((public.job_keyword_group jjkg
    JOIN public.job j ON ((j.id = jjkg.job_id)))
    JOIN public.keyword_group kg ON ((kg.id = jjkg.keyword_group)))
GROUP BY jjkg.keyword_group, kg.label, kg.category
ORDER BY (count(DISTINCT jjkg.job_id)) DESC
WITH NO DATA;

-- ------------------------------------------------------------
-- mv_company
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_company CASCADE;

CREATE MATERIALIZED VIEW public.mv_company AS
SELECT c.id AS company_id,
    c.name AS company_name,
    c.link AS company_link,
    c.type AS company_type,
    count(DISTINCT j.id) AS job_count,
    array_agg(DISTINCT jkg.keyword_group) AS keyword_groups
FROM ((public.company c
    JOIN public.job j ON ((j.company_id = c.id)))
    JOIN public.job_keyword_group jkg ON ((jkg.job_id = j.id)))
WHERE (j.closed = false)
GROUP BY c.id, c.name, c.link, c.type
HAVING (count(DISTINCT j.id) > 0)
ORDER BY (count(DISTINCT j.id)) DESC
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_company_company_id
    ON public.mv_company USING btree (company_id);

CREATE INDEX IF NOT EXISTS ix_mv_company_job_count
    ON public.mv_company USING btree (job_count);

CREATE INDEX IF NOT EXISTS ix_mv_company_keyword_groups
    ON public.mv_company USING gin (keyword_groups);

CREATE INDEX IF NOT EXISTS ix_mv_company_type
    ON public.mv_company USING btree (company_type);

-- ------------------------------------------------------------
-- mv_job  (depends on location_group, location_group_location)
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_job CASCADE;

CREATE MATERIALIZED VIEW public.mv_job AS
SELECT j.id,
    j.title,
    COALESCE(lg.id, j.location) AS location,
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
FROM (((((public.job j
    JOIN public.job_keyword jk ON ((jk.id = j.id)))
    JOIN public.company c ON ((j.company_id = c.id)))
    LEFT JOIN public.job_keyword_group jkg ON ((jkg.job_id = j.id)))
    LEFT JOIN public.location_group_location lgl ON ((j.location = lgl.location)))
    LEFT JOIN public.location_group lg ON ((lgl.location_group = lg.id)))
WHERE (j.closed = false)
GROUP BY j.id, j.title, COALESCE(lg.id, j.location), j.detail_link, j.salary, j.salary_type, j.min_salary, j.max_salary, j.created_at, j.updated_at, j.description, c.id, c.name, c.link, c.type, jk.description_ch_en_ratio, j.closed
ORDER BY j.min_salary DESC, j.max_salary DESC, j.updated_at DESC
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_job_id_idx
    ON public.mv_job USING btree (id);

CREATE INDEX IF NOT EXISTS ix_mv_job_company_id
    ON public.mv_job USING btree (company_id);

CREATE INDEX IF NOT EXISTS ix_mv_job_keyword_groups
    ON public.mv_job USING gin (keyword_groups);

CREATE INDEX IF NOT EXISTS ix_mv_job_min_salary
    ON public.mv_job USING btree (min_salary DESC);

CREATE INDEX IF NOT EXISTS ix_mv_job_max_salary
    ON public.mv_job USING btree (max_salary DESC);

CREATE INDEX IF NOT EXISTS ix_mv_job_updated_at
    ON public.mv_job USING btree (updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_mv_job_salary_type
    ON public.mv_job USING btree (salary_type);

CREATE INDEX IF NOT EXISTS mv_job_location_idx
    ON public.mv_job USING btree (location);

-- ------------------------------------------------------------
-- mv_location_group  (depends on mv_job)
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_location_group CASCADE;

CREATE MATERIALIZED VIEW public.mv_location_group AS
SELECT j.location,
    count(*) AS count
FROM ((public.mv_job j
    LEFT JOIN public.location_group_location lgl ON ((lgl.location = j.location)))
    LEFT JOIN public.location_group lg ON ((lg.id = lgl.location_group)))
WHERE (lg.id IS NOT NULL)
GROUP BY j.location
ORDER BY (count(*)) DESC
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_location_group_idx
    ON public.mv_location_group USING btree (location);

-- ------------------------------------------------------------
-- mv_tech_combo_stats
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS public.mv_tech_combo_stats CASCADE;

CREATE MATERIALIZED VIEW public.mv_tech_combo_stats AS
SELECT a.keyword_group AS tech1,
    b.keyword_group AS tech2,
    COALESCE(max(kga.label), a.keyword_group) AS tech1_label,
    COALESCE(max(kgb.label), b.keyword_group) AS tech2_label,
    max(kga.category) AS cat1,
    max(kgb.category) AS cat2,
    count(DISTINCT a.job_id) AS job_count,
    round(avg(CASE WHEN ((j.salary_type = 'month'::text) AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.min_salary)::numeric ELSE NULL::numeric END)) AS avg_min_month,
    round(avg(CASE WHEN ((j.salary_type = 'month'::text) AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.max_salary)::numeric ELSE NULL::numeric END)) AS avg_max_month,
    round(avg(CASE WHEN ((j.salary_type = 'year'::text)  AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.min_salary)::numeric ELSE NULL::numeric END)) AS avg_min_year,
    round(avg(CASE WHEN ((j.salary_type = 'year'::text)  AND (j.min_salary > 0) AND (j.max_salary < 9999999)) THEN (j.max_salary)::numeric ELSE NULL::numeric END)) AS avg_max_year
FROM ((((public.job_keyword_group a
    JOIN public.job_keyword_group b ON (((a.job_id = b.job_id) AND (a.keyword_group < b.keyword_group))))
    JOIN public.job j ON ((j.id = a.job_id)))
    JOIN public.keyword_group kga ON ((kga.id = a.keyword_group)))
    JOIN public.keyword_group kgb ON ((kgb.id = b.keyword_group)))
WHERE ((kga.category = ANY (ARRAY['Language'::text, 'Framework'::text]))
    AND (kgb.category = ANY (ARRAY['Language'::text, 'Framework'::text]))
    AND (NOT ((kga.parent = kgb.id) OR (kgb.parent = kga.id)))
    AND (a.keyword_group <> ALL (ARRAY['css'::text, 'html'::text, 'javascript'::text, 'sql'::text]))
    AND (b.keyword_group <> ALL (ARRAY['css'::text, 'html'::text, 'javascript'::text, 'sql'::text])))
GROUP BY a.keyword_group, b.keyword_group
HAVING (count(DISTINCT a.job_id) >= 10)
ORDER BY (count(DISTINCT a.job_id)) DESC
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_tech_combo_stats_tech1_tech2
    ON public.mv_tech_combo_stats USING btree (tech1, tech2);

CREATE INDEX IF NOT EXISTS ix_mv_tech_combo_stats_job_count
    ON public.mv_tech_combo_stats USING btree (job_count DESC);

CREATE INDEX IF NOT EXISTS ix_mv_tech_combo_stats_tech1
    ON public.mv_tech_combo_stats USING btree (tech1);

CREATE INDEX IF NOT EXISTS ix_mv_tech_combo_stats_tech2
    ON public.mv_tech_combo_stats USING btree (tech2);

-- ============================================================
-- 8. FUNCTIONS & PROCEDURES
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions (no matview dependency)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_weighted_market_ratio()
RETURNS TABLE(weighted_market_ratio numeric, total_valid_samples bigint)
LANGUAGE sql
AS $function$
  WITH ratio_counts AS (
    SELECT
      ROUND(CAST(max_salary AS NUMERIC) / min_salary, 2) AS ratio,
      COUNT(*) AS group_count
    FROM job
    WHERE
      min_salary > 0
      AND max_salary < 9999999
      AND max_salary >= min_salary
    GROUP BY 1
    ORDER BY group_count DESC
  )
  SELECT
    ROUND(SUM(ratio * group_count) / SUM(group_count), 2) AS weighted_market_ratio,
    SUM(group_count) AS total_valid_samples
  FROM ratio_counts;
$function$;

CREATE OR REPLACE FUNCTION public.get_job_count()
RETURNS TABLE(month_salary_type_jobs numeric, year_salary_type_jobs numeric, open_jobs numeric, jobs numeric)
LANGUAGE sql
AS $function$
SELECT
  (SELECT count(*) FILTER (WHERE max_salary <> 9999999 AND min_salary <> 0 AND salary_type = 'month') FROM job) AS month_salary_type_jobs,
  (SELECT count(*) FILTER (WHERE max_salary <> 9999999 AND min_salary <> 0 AND salary_type = 'year')  FROM job) AS year_salary_type_jobs,
  (SELECT count(*) FROM job WHERE closed = false) AS open_jobs,
  (SELECT count(*) FROM job) AS jobs
$function$;

CREATE OR REPLACE FUNCTION public.get_job_salary_stats()
RETURNS TABLE(avg_min_salary_month numeric, avg_max_salary_month numeric, avg_min_salary_year numeric, avg_max_salary_year numeric)
LANGUAGE sql
AS $function$
  SELECT
    avg(min_salary) FILTER (WHERE min_salary <> 0 AND salary_type = 'month') AS avg_min_salary_month,
    avg(max_salary) FILTER (WHERE max_salary <> 9999999 AND salary_type = 'month') AS avg_max_salary_month,
    avg(min_salary) FILTER (WHERE min_salary <> 0 AND salary_type = 'year') AS avg_min_salary_year,
    avg(max_salary) FILTER (WHERE max_salary <> 9999999 AND salary_type = 'year') AS avg_max_salary_year
  FROM job;
$function$;

CREATE OR REPLACE FUNCTION public.get_salary_stats()
RETURNS TABLE(salary_type text, avg_mark numeric, high_mark numeric, top_mark numeric)
LANGUAGE sql
STABLE
AS $function$
WITH
  ratio_counts AS (
    SELECT
      ROUND(CAST(max_salary AS numeric) / min_salary, 2) AS ratio,
      COUNT(*) AS group_count
    FROM job
    WHERE min_salary > 0 AND max_salary < 9999999 AND max_salary >= min_salary
    GROUP BY 1
  ),
  weighted_ratio AS (
    SELECT ROUND(SUM(ratio * group_count) / SUM(group_count), 2) AS ratio
    FROM ratio_counts
  ),
  job_salary AS (
    SELECT
      j.salary_type,
      CASE
        WHEN j.min_salary > 0 AND j.max_salary < 9999999 AND j.max_salary >= j.min_salary
          THEN ROUND((j.min_salary + j.max_salary) / 2.0, 0)
        WHEN j.min_salary > 0 AND j.max_salary = 9999999
          THEN ROUND((j.min_salary + j.min_salary * wr.ratio) / 2.0, 0)
        ELSE NULL
      END AS representative_salary
    FROM job j
    CROSS JOIN weighted_ratio wr
    WHERE j.salary_type IN ('month', 'year') AND j.closed = false
  )
SELECT
  salary_type,
  ROUND(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS avg_mark,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS high_mark,
  ROUND(PERCENTILE_CONT(0.88) WITHIN GROUP (ORDER BY representative_salary)::numeric, 0) AS top_mark
FROM job_salary
WHERE representative_salary IS NOT NULL
GROUP BY salary_type
ORDER BY salary_type;
$function$;


CREATE OR REPLACE FUNCTION public.get_job_preference_count(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $function$
SELECT json_build_object(
    'liked_count',    COUNT(*) FILTER (WHERE preference = 'like'),
    'disliked_count', COUNT(*) FILTER (WHERE preference = 'dislike')
  )
FROM job_preference jp
LEFT JOIN job j ON j.id = jp.job_id
WHERE user_id = p_user_id AND j.closed = false
$function$;

CREATE OR REPLACE FUNCTION public.reset_keywords()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
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
    SELECT DISTINCT kw FROM job_keyword, UNNEST(keywords) AS kw
  );

  ALTER TABLE keyword_group_keyword
    ADD CONSTRAINT keyword_group_keyword_mapping_keyword_fkey
    FOREIGN KEY (keyword) REFERENCES keyword(id);
END;
$function$;

-- ------------------------------------------------------------
-- Materialized view refresh functions
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_mv_keyword_group_category()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_keyword_group_category;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_keyword_group()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_keyword_group;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_company()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_company;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_job;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_location_group()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_location_group;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_mv_tech_combo_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tech_combo_stats;
END;
$function$;

-- ------------------------------------------------------------
-- Functions that depend on materialized views
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_unreviewed_jobs(p_user_id uuid)
RETURNS SETOF public.mv_job
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

CREATE OR REPLACE FUNCTION public.get_jobs_by_preference(p_user_id uuid, p_preference text)
RETURNS SETOF public.mv_job
LANGUAGE sql
STABLE
AS $function$
  SELECT j.*
  FROM mv_job j
  WHERE EXISTS (
    SELECT 1 FROM job_preference jp
    WHERE jp.job_id = j.id
      AND jp.user_id = p_user_id
      AND jp.preference = p_preference
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_tech_combo_stats(p_limit integer DEFAULT 15)
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
  ORDER BY job_count DESC
  LIMIT p_limit;
$function$;

-- ============================================================
-- 9. TRIGGERS
-- ============================================================

-- No triggers defined.

-- ============================================================
-- 10. CRON JOBS
-- ============================================================

-- No cron jobs defined.

-- ============================================================
-- 11. STORAGE BUCKETS
-- ============================================================

-- No storage buckets defined.

-- ============================================================
-- 12. REALTIME
-- ============================================================

-- No realtime publications defined.
