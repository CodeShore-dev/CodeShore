-- Adds `crawled_at timestamptz` to `mv_job` by rebuilding the materialized
-- view.
--
-- `apps/crawler/src/staleness-sync.ts`'s `fetchStaleEntities` (the admin
-- re-crawl query, successor to `main.ts`'s old `reCrawlJobs`) already
-- filters `MvJobService` results by `crawled_at`, but `mv_job` has never
-- exposed that column -- it was deliberately left out when `job.updated_at`
-- was split into `crawled_at`/`updated_at`
-- (`20260718000000_split_job_crawled_updated_at.sql`: "mv_job intentionally
-- does not expose crawled_at per design.md Non-Goals"). That query has been
-- broken ever since (`column "crawled_at" does not exist` against the
-- view). This migration reverses that Non-Goal now that a real caller needs
-- the column.
--
-- Same drop/rebuild as the two prior mv_job migrations
-- (`20260714020000_alter_mv_job_add_keyword_groups.sql`,
-- `20260718000000_split_job_crawled_updated_at.sql`): Postgres materialized
-- views don't support `CREATE OR REPLACE`, and `get_unreviewed_jobs`
-- (`RETURNS SETOF mv_job`) / `get_jobs_by_preference` (`RETURNS TABLE`,
-- populated via `j.*`) both have hard dependencies on mv_job's composite
-- type and must be dropped first, then recreated after.
--
-- `crawled_at` is appended as the last column (after `keyword_groups`)
-- rather than inserted next to `updated_at`/`created_at`, so every existing
-- column in `get_jobs_by_preference`'s `j.*` expansion keeps its current
-- position -- only the new column is added, ahead of the manually appended
-- `preference_updated_at`.
--
-- `ix_mv_job_crawled_at` mirrors the existing `ix_mv_job_updated_at` so the
-- new `fetchStaleEntities` `crawled_at < ...` filter isn't a sequential
-- scan over a view already prone to statement timeouts
-- (`20260717000000_alter_refresh_mv_job_statement_timeout.sql`).

DROP FUNCTION IF EXISTS public.get_unreviewed_jobs(uuid);
DROP FUNCTION IF EXISTS public.get_jobs_by_preference(uuid, text);
DROP MATERIALIZED VIEW IF EXISTS public.mv_job;

CREATE MATERIALIZED VIEW public."mv_job" AS
 SELECT j.id,
    j.title,
    COALESCE(lg.id, j.location) AS location,
    j.detail_link,
    j.salary,
    j.salary_type,
    j.min_salary,
    j.max_salary,
        CASE
            WHEN j.min_salary > 0 AND j.max_salary < 9999999 THEN round((j.min_salary + j.max_salary)::numeric / 2.0, 0)
            WHEN j.min_salary > 0 AND j.max_salary = 9999999 THEN round(j.min_salary::numeric * (1.0 + mv.ratio) / 2.0, 0)
            ELSE NULL::numeric
        END AS avg_salary,
    j.created_at,
    j.updated_at,
    j.description,
    c.id AS company_id,
    c.name AS company_name,
    c.link AS company_link,
    c.type AS company_type,
    array_agg(jkg.tech) FILTER (WHERE jkg.tech IS NOT NULL) AS techs,
    array_agg((jkg.tech || ':'::text) || jkg.keywords) FILTER (WHERE jkg.tech IS NOT NULL) AS tech_mappings,
    j.closed,
    jk.description_ch_en_ratio,
    jk.keyword_groups,
    j.crawled_at
   FROM job j
     JOIN job_keyword jk ON jk.id = j.id
     JOIN company c ON j.company_id = c.id
     LEFT JOIN job_tech jkg ON jkg.job_id = j.id
     LEFT JOIN location_group_location lgl ON j.location = lgl.location
     LEFT JOIN location_group lg ON lgl.location_group = lg.id
     LEFT JOIN mv_salary_range_multiplier mv ON j.salary_type = mv.salary_type
  WHERE j.closed = false
  GROUP BY j.id, j.title, (COALESCE(lg.id, j.location)), j.detail_link, j.salary, j.salary_type, j.min_salary, j.max_salary, j.created_at, j.updated_at, j.description, c.id, c.name, c.link, c.type, jk.description_ch_en_ratio, j.closed, mv.ratio, jk.keyword_groups, j.crawled_at
  ORDER BY j.min_salary DESC, j.max_salary DESC, j.updated_at DESC;

CREATE UNIQUE INDEX mv_job_id_idx ON public.mv_job USING btree (id);
CREATE INDEX ix_mv_job_company_id ON public.mv_job USING btree (company_id);
CREATE INDEX ix_mv_job_max_salary ON public.mv_job USING btree (max_salary DESC);
CREATE INDEX ix_mv_job_min_salary ON public.mv_job USING btree (min_salary DESC);
CREATE INDEX ix_mv_job_salary_type ON public.mv_job USING btree (salary_type);
CREATE INDEX ix_mv_job_techs ON public.mv_job USING gin (techs);
CREATE INDEX ix_mv_job_updated_at ON public.mv_job USING btree (updated_at DESC);
CREATE INDEX mv_job_location_idx ON public.mv_job USING btree (location);
CREATE INDEX ix_mv_job_crawled_at ON public.mv_job USING btree (crawled_at DESC);

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

CREATE OR REPLACE FUNCTION public.get_jobs_by_preference(p_user_id uuid, p_preference text)
 RETURNS TABLE(id text, title text, location text, detail_link text, salary text, salary_type text, min_salary integer, max_salary integer, avg_salary numeric, created_at timestamp with time zone, updated_at timestamp with time zone, description text, company_id text, company_name text, company_link text, company_type text, techs text[], tech_mappings text[], closed boolean, description_ch_en_ratio numeric, keyword_groups jsonb, crawled_at timestamp with time zone, preference_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT j.*, jp.updated_at AS preference_updated_at
  FROM mv_job j
  JOIN job_preference jp
    ON jp.job_id = j.id
   AND jp.user_id = p_user_id
   AND jp.preference = p_preference;
$function$;
